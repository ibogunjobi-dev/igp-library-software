// ============================================================================
// Izy Global Partners LLP — Library Management System
// Local API server (Express + SQLite) for development / testing.
//
// All data routes require an authenticated admin (the Librarian). Roles 'fc'
// and 'member' are reserved for Phase 2 (see ROADMAP.md).
//
// Production target is PostgreSQL — this server mirrors db/schema.postgres.sql.
// ============================================================================

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  db,
  nextId,
  ensureCounterAtLeast,
  parseIdNumber,
  catalogueToApi,
  memberToApi,
  loanToApi,
  settingsToApi,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use a dedicated env var (not PORT) so the API port is independent of any
// generic PORT injected by a dev/preview harness for the web server.
const PORT = process.env.IGP_API_PORT || 4000;
// In development use a stable default secret; set IGP_JWT_SECRET in production.
const JWT_SECRET = process.env.IGP_JWT_SECRET || 'igp-dev-secret-change-me';

// --- Controlled vocabularies (kept in step with src/lib/constants.js) ------
const GROUPINGS = [
  'Textbooks',
  'Laws / Statutes',
  'Legal Books / Essays / Commentaries',
  'Law Reports',
  'Reference Collections',
];
const NON_LOANABLE_STATUSES = ['Reference only', 'Missing', 'Withdrawn'];
const FIRM_AUTHORED_TITLES = ['Modern Nigerian Law of Contract', 'Through the Cases'];

// --- Helpers ---------------------------------------------------------------
const norm = (v) => String(v ?? '').trim().toLowerCase();
const isFirmAuthored = (title) => FIRM_AUTHORED_TITLES.some((t) => norm(t) === norm(title));
const todayIso = () => new Date().toISOString().slice(0, 10);

function addDaysIso(baseIso, days) {
  const d = baseIso ? new Date(baseIso) : new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function keywordsToJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((s) => String(s).trim()).filter(Boolean));
  if (!value) return '[]';
  return JSON.stringify(String(value).split(/[;,]/).map((s) => s.trim()).filter(Boolean));
}

// --- App -------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// --- Authentication --------------------------------------------------------
function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '12h',
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

// Phase 1: every data route requires the admin role. The check is role-based
// so Phase 2 can introduce fc/member-scoped routes without changing this shape.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Not authorised.' });
    }
    next();
  };
}
const requireAdmin = [authMiddleware, requireRole('admin')];

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: signToken(user), user: { email: user.email, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { email: req.user.email, role: req.user.role } });
});

// --- Settings --------------------------------------------------------------
app.get('/api/settings', requireAdmin, (_req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settingsToApi(row));
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE settings SET
       loan_period_days = ?, renewal_length_days = ?, allow_renewals = ?
     WHERE id = 1`
  ).run(
    Math.max(1, parseInt(b.loanPeriodDays, 10) || 14),
    Math.max(1, parseInt(b.renewalLengthDays, 10) || 14),
    b.allowRenewals ? 1 : 0
  );
  res.json(settingsToApi(db.prepare('SELECT * FROM settings WHERE id = 1').get()));
});

// --- Catalogue -------------------------------------------------------------
app.get('/api/catalogue', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM catalogue ORDER BY accession_number').all();
  res.json(rows.map(catalogueToApi));
});

app.get('/api/catalogue/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Catalogue record not found.' });
  res.json(catalogueToApi(row));
});

app.post('/api/catalogue', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'Title is required.' });
  if (!GROUPINGS.includes(b.grouping)) return res.status(400).json({ error: 'A valid grouping is required.' });

  try {
    const created = db.transaction(() => {
      let accession = b.accessionNumber ? String(b.accessionNumber).trim() : '';
      if (accession) {
        const n = parseIdNumber(accession);
        if (Number.isFinite(n)) ensureCounterAtLeast('accession', n);
      } else {
        accession = nextId('accession');
      }
      const copiesTotal = Math.max(1, parseInt(b.copiesTotal, 10) || 1);
      const status = b.status || 'Available';
      const copiesAvailable = status === 'Reference only' ? 0 : copiesTotal;
      const firmAuthorship = b.firmAuthorship === true || isFirmAuthored(b.title) ? 1 : 0;

      const info = db.prepare(
        `INSERT INTO catalogue
          (accession_number, title, authors, publisher, edition, year, isbn, issn,
           grouping, collection, copies_total, copies_available, status,
           firm_authorship, keywords, shelf_location, acquisition_date, volume, part, notes)
         VALUES (@accession_number, @title, @authors, @publisher, @edition, @year, @isbn, @issn,
           @grouping, @collection, @copies_total, @copies_available, @status,
           @firm_authorship, @keywords, @shelf_location, @acquisition_date, @volume, @part, @notes)`
      ).run({
        accession_number: accession,
        title: String(b.title).trim(),
        authors: b.authors ?? '',
        publisher: (b.publisher ?? '').trim?.() ?? b.publisher ?? '',
        edition: (b.edition ?? '').trim?.() ?? b.edition ?? '',
        year: String(b.year ?? ''),
        isbn: (b.isbn ?? '').trim?.() ?? b.isbn ?? '',
        issn: (b.issn ?? '').trim?.() ?? b.issn ?? '',
        grouping: b.grouping,
        collection: b.collection || 'Izy Global Partners LLP',
        copies_total: copiesTotal,
        copies_available: copiesAvailable,
        status,
        firm_authorship: firmAuthorship,
        keywords: keywordsToJson(b.keywords),
        shelf_location: (b.shelfLocation ?? '').trim?.() ?? b.shelfLocation ?? '',
        acquisition_date: b.acquisitionDate || null,
        volume: String(b.volume ?? ''),
        part: String(b.part ?? ''),
        notes: (b.notes ?? '').trim?.() ?? b.notes ?? '',
      });
      return db.prepare('SELECT * FROM catalogue WHERE id = ?').get(info.lastInsertRowid);
    })();
    res.status(201).json(catalogueToApi(created));
  } catch (err) {
    res.status(400).json({ error: friendlySqlite(err) });
  }
});

app.put('/api/catalogue/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Catalogue record not found.' });
  const b = req.body || {};
  if (b.grouping && !GROUPINGS.includes(b.grouping)) {
    return res.status(400).json({ error: 'A valid grouping is required.' });
  }

  // Whitelist editable fields (camelCase -> column).
  const map = {
    title: 'title', authors: 'authors', publisher: 'publisher', edition: 'edition',
    year: 'year', isbn: 'isbn', issn: 'issn', grouping: 'grouping', collection: 'collection',
    status: 'status', firmAuthorship: 'firm_authorship', shelfLocation: 'shelf_location',
    acquisitionDate: 'acquisition_date', volume: 'volume', part: 'part', notes: 'notes',
  };
  const sets = [];
  const params = {};
  for (const [key, col] of Object.entries(map)) {
    if (b[key] === undefined) continue;
    sets.push(`${col} = @${col}`);
    if (key === 'firmAuthorship') params[col] = b[key] ? 1 : 0;
    else if (key === 'acquisitionDate') params[col] = b[key] || null;
    else params[col] = b[key];
  }
  if (b.keywords !== undefined) { sets.push('keywords = @keywords'); params.keywords = keywordsToJson(b.keywords); }
  if (b.copiesTotal !== undefined) {
    const total = Math.max(1, parseInt(b.copiesTotal, 10) || 1);
    sets.push('copies_total = @copies_total');
    params.copies_total = total;
    // Keep availability within the new total (never negative, never over total).
    const onLoan = existing.copies_total - existing.copies_available;
    sets.push('copies_available = @copies_available');
    params.copies_available = Math.max(0, total - Math.max(0, onLoan));
  }
  sets.push("updated_at = datetime('now')");
  params.id = req.params.id;

  try {
    db.prepare(`UPDATE catalogue SET ${sets.join(', ')} WHERE id = @id`).run(params);
    res.json(catalogueToApi(db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: friendlySqlite(err) });
  }
});

// Increment copy count (duplicate roll-up).
app.post('/api/catalogue/:id/copies', requireAdmin, (req, res) => {
  const by = Math.max(1, parseInt(req.body?.by, 10) || 1);
  const row = db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Catalogue record not found.' });
  db.prepare(
    `UPDATE catalogue
       SET copies_total = copies_total + ?, copies_available = copies_available + ?,
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(by, by, req.params.id);
  res.json(catalogueToApi(db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id)));
});

// Status change (withdraw / mark missing / restore) without deletion.
app.patch('/api/catalogue/:id/status', requireAdmin, (req, res) => {
  const status = req.body?.status;
  const valid = ['Available', 'On loan', 'Reference only', 'Missing', 'Withdrawn'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const row = db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Catalogue record not found.' });
  db.prepare("UPDATE catalogue SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, req.params.id);
  res.json(catalogueToApi(db.prepare('SELECT * FROM catalogue WHERE id = ?').get(req.params.id)));
});

// --- Members ---------------------------------------------------------------
app.get('/api/members', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM members ORDER BY member_id').all();
  res.json(rows.map(memberToApi));
});

app.get('/api/members/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Member not found.' });
  res.json(memberToApi(row));
});

app.post('/api/members', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.fullName || !String(b.fullName).trim()) return res.status(400).json({ error: 'Full name is required.' });
  try {
    const created = db.transaction(() => {
      const memberId = nextId('member');
      const info = db.prepare(
        `INSERT INTO members
           (member_id, full_name, member_type, email, phone, date_added, status, notes, linked_auth_uid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      ).run(
        memberId,
        String(b.fullName).trim(),
        b.memberType || 'Other',
        (b.email ?? '').trim(),
        (b.phone ?? '').trim(),
        b.dateAdded || todayIso(),
        b.status || 'Active',
        (b.notes ?? '').trim()
      );
      return db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid);
    })();
    res.status(201).json(memberToApi(created));
  } catch (err) {
    res.status(400).json({ error: friendlySqlite(err) });
  }
});

app.put('/api/members/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Member not found.' });
  const b = req.body || {};
  const map = {
    fullName: 'full_name', memberType: 'member_type', email: 'email', phone: 'phone',
    dateAdded: 'date_added', status: 'status', notes: 'notes',
  };
  const sets = [];
  const params = { id: req.params.id };
  for (const [key, col] of Object.entries(map)) {
    if (b[key] === undefined) continue;
    sets.push(`${col} = @${col}`);
    params[col] = b[key];
  }
  if (sets.length === 0) return res.json(memberToApi(existing));
  sets.push("updated_at = datetime('now')");
  try {
    db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = @id`).run(params);
    res.json(memberToApi(db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: friendlySqlite(err) });
  }
});

// --- Loans -----------------------------------------------------------------
app.get('/api/loans', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM loans ORDER BY date_issued DESC, id DESC').all();
  res.json(rows.map(loanToApi));
});

// Issue a loan (atomic availability check + decrement + insert).
app.post('/api/loans', requireAdmin, (req, res) => {
  const b = req.body || {};
  const book = db.prepare('SELECT * FROM catalogue WHERE id = ?').get(b.bookId);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(b.memberId);
  if (!book) return res.status(404).json({ error: 'Selected book not found.' });
  if (!member) return res.status(404).json({ error: 'Selected member not found.' });

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  try {
    const loan = db.transaction(() => {
      if (NON_LOANABLE_STATUSES.includes(book.status)) {
        throw new Error(`This item is "${book.status}" and cannot be loaned.`);
      }
      if ((book.copies_available || 0) <= 0) {
        throw new Error('No copies are currently available to loan.');
      }
      const loanId = nextId('loan');
      const dateIssued = todayIso();
      const dueDate = b.dueDate || addDaysIso(dateIssued, settings.loan_period_days);
      const newAvailable = book.copies_available - 1;

      db.prepare(
        `UPDATE catalogue
           SET copies_available = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(newAvailable, newAvailable === 0 ? 'On loan' : book.status, book.id);

      const info = db.prepare(
        `INSERT INTO loans
           (loan_id, accession_number, book_title, member_id, member_name,
            date_issued, due_date, date_returned, status, renewed_count, issued_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'On loan', 0, ?, ?)`
      ).run(
        loanId, book.accession_number, book.title, member.member_id, member.full_name,
        dateIssued, dueDate, b.issuedBy || req.user.email || 'admin', (b.notes ?? '').trim()
      );
      return db.prepare('SELECT * FROM loans WHERE id = ?').get(info.lastInsertRowid);
    })();
    res.status(201).json(loanToApi(loan));
  } catch (err) {
    res.status(400).json({ error: err.message || friendlySqlite(err) });
  }
});

// Return a loan.
app.post('/api/loans/:id/return', requireAdmin, (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });
  if (loan.date_returned) return res.status(400).json({ error: 'This loan is already returned.' });

  try {
    db.transaction(() => {
      const book = db.prepare('SELECT * FROM catalogue WHERE accession_number = ?').get(loan.accession_number);
      if (book) {
        const newAvailable = Math.min((book.copies_available || 0) + 1, book.copies_total);
        const status = book.status === 'On loan' && newAvailable > 0 ? 'Available' : book.status;
        db.prepare(
          `UPDATE catalogue SET copies_available = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(newAvailable, status, book.id);
      }
      db.prepare(
        `UPDATE loans SET date_returned = ?, status = 'Returned', updated_at = datetime('now') WHERE id = ?`
      ).run(todayIso(), loan.id);
    })();
    res.json(loanToApi(db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: friendlySqlite(err) });
  }
});

// Renew a loan (extend due date).
app.post('/api/loans/:id/renew', requireAdmin, (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });
  if (loan.date_returned) return res.status(400).json({ error: 'A returned loan cannot be renewed.' });
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const extendBy = settings.renewal_length_days || settings.loan_period_days || 14;
  const newDue = addDaysIso(loan.due_date || todayIso(), extendBy);
  db.prepare(
    `UPDATE loans SET due_date = ?, renewed_count = renewed_count + 1, updated_at = datetime('now') WHERE id = ?`
  ).run(newDue, loan.id);
  res.json(loanToApi(db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id)));
});

// --- NWLR holdings ---------------------------------------------------------
// The three large contiguous gaps to flag for a shelf re-check (per the brief).
const NWLR_FLAGGED_GAPS = [
  { from: 166, to: 341 },
  { from: 460, to: 1039 },
  { from: 1421, to: 1550 },
];
// Bands are generated dynamically in 500-Part chunks up to the upper bound,
// so the table always covers the whole run (e.g. 2001–2043 once held).
function nwlrBands(upper) {
  const bands = [];
  for (let from = 1; from <= upper; from += 500) {
    const to = Math.min(from + 499, upper);
    bands.push({ label: `${from}–${to}`, from, to });
  }
  return bands;
}

function nwlrConfig() {
  return db.prepare('SELECT * FROM nwlr_config WHERE id = 1').get();
}

// Holdings status: counts overall and per band, plus the flagged gaps.
app.get('/api/nwlr/status', requireAdmin, (_req, res) => {
  const cfg = nwlrConfig();
  const upper = cfg.upper_bound;
  const heldRow = db.prepare("SELECT COUNT(*) n FROM nwlr_parts WHERE status='Held' AND part_no<=?").get(upper);
  const total = db.prepare('SELECT COUNT(*) n FROM nwlr_parts WHERE part_no<=?').get(upper);
  const held = heldRow.n;
  const missing = total.n - held;

  const bands = nwlrBands(upper).map((b) => {
    const h = db.prepare("SELECT COUNT(*) n FROM nwlr_parts WHERE status='Held' AND part_no BETWEEN ? AND ?").get(b.from, b.to).n;
    const t = db.prepare('SELECT COUNT(*) n FROM nwlr_parts WHERE part_no BETWEEN ? AND ?').get(b.from, b.to).n;
    return { label: b.label, held: h, missing: t - h, total: t };
  });

  res.json({
    upperBound: upper,
    upperProvisional: !!cfg.upper_provisional,
    serialAccession: cfg.serial_accession,
    held,
    missing,
    total: total.n,
    bands,
    flaggedGaps: NWLR_FLAGGED_GAPS,
  });
});

// Full Parts list within the run, optionally filtered by status — used to
// export the Missing list and the Available (Held) list to Excel.
app.get('/api/nwlr/parts', requireAdmin, (req, res) => {
  const cfg = nwlrConfig();
  const upper = cfg.upper_bound;
  const want = req.query.status; // 'Held' | 'Missing' | undefined (all)
  let rows;
  if (want === 'Held' || want === 'Missing') {
    rows = db.prepare('SELECT part_no, status FROM nwlr_parts WHERE part_no<=? AND status=? ORDER BY part_no').all(upper, want);
  } else {
    rows = db.prepare('SELECT part_no, status FROM nwlr_parts WHERE part_no<=? ORDER BY part_no').all(upper);
  }
  res.json({ upperBound: upper, parts: rows.map((r) => ({ part: r.part_no, status: r.status })) });
});

// Per-Part lookup.
app.get('/api/nwlr/part/:n', requireAdmin, (req, res) => {
  const n = parseInt(req.params.n, 10);
  if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Enter a valid Part number.' });
  const cfg = nwlrConfig();
  if (n > cfg.upper_bound) return res.json({ part: n, status: 'Beyond recorded run', upperBound: cfg.upper_bound });
  const row = db.prepare('SELECT status FROM nwlr_parts WHERE part_no = ?').get(n);
  res.json({ part: n, status: row ? row.status : 'Held' });
});

// Flip a Part Missing -> Held (when later acquired). Available count updates automatically.
app.post('/api/nwlr/part/:n/hold', requireAdmin, (req, res) => {
  const n = parseInt(req.params.n, 10);
  if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Enter a valid Part number.' });
  db.prepare('INSERT INTO nwlr_parts (part_no, status) VALUES (?, ?) ON CONFLICT(part_no) DO UPDATE SET status=excluded.status')
    .run(n, 'Held');
  res.json({ part: n, status: 'Held' });
});

// Raise (or lower) the provisional upper bound of the run.
app.put('/api/nwlr/upper-bound', requireAdmin, (req, res) => {
  const upper = parseInt(req.body?.upperBound, 10);
  if (!Number.isFinite(upper) || upper < 1) return res.status(400).json({ error: 'Enter a valid upper bound.' });
  const provisional = req.body?.upperProvisional === false ? 0 : 1;
  // Any newly-included Parts default to Held unless explicitly recorded missing.
  const existingMax = db.prepare('SELECT COALESCE(MAX(part_no),0) m FROM nwlr_parts').get().m;
  const fill = db.prepare("INSERT OR IGNORE INTO nwlr_parts (part_no, status) VALUES (?, 'Held')");
  const tx = db.transaction(() => {
    for (let p = existingMax + 1; p <= upper; p += 1) fill.run(p);
    db.prepare('UPDATE nwlr_config SET upper_bound = ?, upper_provisional = ? WHERE id = 1').run(upper, provisional);
  });
  tx();
  res.json({ upperBound: upper, upperProvisional: !!provisional });
});

// --- Law reports -----------------------------------------------------------
// A law report series is either Part-based ('parts', e.g. NWLR — counts come
// from the NWLR dataset) or volume-based ('volumes', e.g. LRECN). Each series
// carries searchable index entries.

function seriesSummary(s) {
  const indexCount = db.prepare('SELECT COUNT(*) n FROM law_report_indexes WHERE series_id=?').get(s.id).n;
  let held = 0, total = 0;
  if (s.kind === 'parts') {
    const cfg = nwlrConfig();
    const upper = cfg.upper_bound;
    total = db.prepare('SELECT COUNT(*) n FROM nwlr_parts WHERE part_no<=?').get(upper).n;
    held = db.prepare("SELECT COUNT(*) n FROM nwlr_parts WHERE status='Held' AND part_no<=?").get(upper).n;
  } else {
    total = db.prepare('SELECT COUNT(*) n FROM law_report_volumes WHERE series_id=?').get(s.id).n;
    held = db.prepare("SELECT COUNT(*) n FROM law_report_volumes WHERE series_id=? AND status='Held'").get(s.id).n;
  }
  return {
    id: s.id, abbreviation: s.abbreviation, name: s.name, kind: s.kind,
    serialAccession: s.serial_accession, description: s.description,
    held, total, missing: total - held, indexCount,
  };
}

// List all series.
app.get('/api/law-reports', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM law_report_series ORDER BY sort_order, name').all();
  res.json(rows.map(seriesSummary));
});

// Create a series (and a matching catalogue serial record). Lets the Librarian
// add other law reports from the app.
app.post('/api/law-reports', requireAdmin, (req, res) => {
  const b = req.body || {};
  const abbreviation = String(b.abbreviation || '').trim();
  const name = String(b.name || '').trim();
  const kind = b.kind === 'parts' ? 'parts' : 'volumes';
  if (!abbreviation || !name) return res.status(400).json({ error: 'Abbreviation and name are required.' });
  try {
    const created = db.transaction(() => {
      // Create the catalogue serial record (Law Reports, reference-only).
      const accession = nextId('accession');
      db.prepare(
        `INSERT INTO catalogue (accession_number, title, authors, grouping, collection,
            copies_total, copies_available, status, notes)
         VALUES (?, ?, '', 'Law Reports', 'Izy Global Partners LLP', 1, 0, 'Reference only', ?)`
      ).run(accession, name, `Law report serial — ${abbreviation}.`);
      const info = db.prepare(
        'INSERT INTO law_report_series (abbreviation, name, kind, serial_accession, description, sort_order) VALUES (?,?,?,?,?,?)'
      ).run(abbreviation, name, kind, accession, b.description || '', parseInt(b.sortOrder, 10) || 100);
      return db.prepare('SELECT * FROM law_report_series WHERE id=?').get(info.lastInsertRowid);
    })();
    res.status(201).json(seriesSummary(created));
  } catch (err) {
    res.status(400).json({ error: friendlySqlite(err) });
  }
});

// Series detail (with its volumes for volume-based series).
app.get('/api/law-reports/:id', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT * FROM law_report_series WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Law report series not found.' });
  const summary = seriesSummary(s);
  const volumes = s.kind === 'volumes'
    ? db.prepare('SELECT id, label, year, volume, status, notes FROM law_report_volumes WHERE series_id=? ORDER BY sort_order, id').all(s.id)
    : [];
  res.json({ ...summary, volumes });
});

// Search a series' index entries (title / reference / keywords / notes).
app.get('/api/law-reports/:id/indexes', requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(
      `SELECT id, title, reference, keywords, notes FROM law_report_indexes
        WHERE series_id=? AND (
          lower(title) LIKE ? OR lower(reference) LIKE ? OR
          lower(keywords) LIKE ? OR lower(notes) LIKE ?)
        ORDER BY title`
    ).all(req.params.id, like, like, like, like);
  } else {
    rows = db.prepare('SELECT id, title, reference, keywords, notes FROM law_report_indexes WHERE series_id=? ORDER BY title').all(req.params.id);
  }
  res.json(rows);
});

// Add an index entry to a series.
app.post('/api/law-reports/:id/indexes', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT id FROM law_report_series WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Law report series not found.' });
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Index title is required.' });
  const info = db.prepare(
    'INSERT INTO law_report_indexes (series_id, title, reference, keywords, notes) VALUES (?,?,?,?,?)'
  ).run(req.params.id, String(b.title).trim(), b.reference || '', b.keywords || '', b.notes || '');
  res.status(201).json(db.prepare('SELECT id, title, reference, keywords, notes FROM law_report_indexes WHERE id=?').get(info.lastInsertRowid));
});

// Add a volume to a volume-based series.
app.post('/api/law-reports/:id/volumes', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT * FROM law_report_series WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Law report series not found.' });
  if (s.kind !== 'volumes') return res.status(400).json({ error: 'This series is not volume-based.' });
  const b = req.body || {};
  if (!String(b.label || '').trim()) return res.status(400).json({ error: 'Volume label is required.' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) m FROM law_report_volumes WHERE series_id=?').get(req.params.id).m;
  const info = db.prepare(
    'INSERT INTO law_report_volumes (series_id, label, year, volume, status, sort_order, notes) VALUES (?,?,?,?,?,?,?)'
  ).run(req.params.id, String(b.label).trim(), b.year || '', b.volume || '',
        b.status === 'Missing' ? 'Missing' : 'Held', maxOrder + 1, b.notes || '');
  res.status(201).json(db.prepare('SELECT id, label, year, volume, status, notes FROM law_report_volumes WHERE id=?').get(info.lastInsertRowid));
});

// Toggle / set a volume's held status.
app.patch('/api/law-reports/volumes/:vid', requireAdmin, (req, res) => {
  const v = db.prepare('SELECT * FROM law_report_volumes WHERE id=?').get(req.params.vid);
  if (!v) return res.status(404).json({ error: 'Volume not found.' });
  const status = req.body?.status === 'Missing' ? 'Missing' : 'Held';
  db.prepare('UPDATE law_report_volumes SET status=? WHERE id=?').run(status, req.params.vid);
  res.json({ id: v.id, status });
});

// --- Static serving (production build) -------------------------------------
const distDir = resolve(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback for non-API routes.
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(distDir, 'index.html')));
}

function friendlySqlite(err) {
  const m = err?.message || '';
  if (m.includes('UNIQUE')) return 'A record with that unique value already exists.';
  if (m.includes('CHECK')) return 'A value is outside the allowed range.';
  return m || 'Request failed.';
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[Izy Global Partners LLP] Library API listening on http://localhost:${PORT}`);
});
