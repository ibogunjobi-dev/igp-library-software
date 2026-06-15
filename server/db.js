// ============================================================================
// SQLite connection, schema bootstrap, and row <-> API mapping helpers.
// (Local development / testing backend. Production target is PostgreSQL —
//  see db/schema.postgres.sql.)
// ============================================================================

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database file location (override with IGP_DB_FILE).
const DB_FILE = process.env.IGP_DB_FILE || resolve(__dirname, 'data', 'igp-library.db');

// Ensure the data directory exists.
import { mkdirSync } from 'node:fs';
mkdirSync(dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema (idempotent — uses IF NOT EXISTS throughout).
const schema = readFileSync(resolve(__dirname, 'schema.sqlite.sql'), 'utf8');
db.exec(schema);

// Seed singletons.
db.prepare('INSERT OR IGNORE INTO settings (id) VALUES (1)').run();
db.prepare('INSERT OR IGNORE INTO nwlr_config (id) VALUES (1)').run();
for (const name of ['accession', 'member', 'loan']) {
  db.prepare('INSERT OR IGNORE INTO counters (name, current) VALUES (?, 0)').run(name);
}

// --- Identifier generation --------------------------------------------------
const PREFIX = { accession: 'IGP-LIB-', member: 'IGP-MEM-', loan: 'IGP-LOAN-' };
const PAD = { accession: 5, member: 4, loan: 5 };

export function formatId(sequence, n) {
  return `${PREFIX[sequence]}${String(n).padStart(PAD[sequence], '0')}`;
}

export function parseIdNumber(value) {
  if (!value) return NaN;
  const m = String(value).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : NaN;
}

// Reserve and return the next identifier in a sequence (atomic).
export function nextId(sequence) {
  const row = db.prepare('SELECT current FROM counters WHERE name = ?').get(sequence);
  const value = (row?.current || 0) + 1;
  db.prepare('UPDATE counters SET current = ? WHERE name = ?').run(value, sequence);
  return formatId(sequence, value);
}

// Keep a counter at least `minValue` (so preserved imported numbers never clash).
export function ensureCounterAtLeast(sequence, minValue) {
  if (!Number.isFinite(minValue) || minValue < 0) return;
  const row = db.prepare('SELECT current FROM counters WHERE name = ?').get(sequence);
  if (minValue > (row?.current || 0)) {
    db.prepare('UPDATE counters SET current = ? WHERE name = ?').run(minValue, sequence);
  }
}

// --- Row <-> API mapping ----------------------------------------------------
// API objects use camelCase; SQLite columns use snake_case. Keywords are a JSON
// array; firm_authorship / allow_renewals are booleans.

export function catalogueToApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    accessionNumber: r.accession_number,
    title: r.title,
    authors: r.authors,
    publisher: r.publisher,
    edition: r.edition,
    year: r.year,
    isbn: r.isbn,
    issn: r.issn,
    grouping: r.grouping,
    collection: r.collection,
    copiesTotal: r.copies_total,
    copiesAvailable: r.copies_available,
    status: r.status,
    firmAuthorship: !!r.firm_authorship,
    keywords: safeJsonArray(r.keywords),
    shelfLocation: r.shelf_location,
    acquisitionDate: r.acquisition_date,
    volume: r.volume,
    part: r.part,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function memberToApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    memberId: r.member_id,
    fullName: r.full_name,
    memberType: r.member_type,
    email: r.email,
    phone: r.phone,
    dateAdded: r.date_added,
    status: r.status,
    notes: r.notes,
    linkedAuthUid: r.linked_auth_uid,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function loanToApi(r) {
  if (!r) return null;
  return {
    id: r.id,
    loanId: r.loan_id,
    accessionNumber: r.accession_number,
    bookTitle: r.book_title,
    memberId: r.member_id,
    memberName: r.member_name,
    dateIssued: r.date_issued,
    dueDate: r.due_date,
    dateReturned: r.date_returned,
    status: r.status,
    renewedCount: r.renewed_count,
    issuedBy: r.issued_by,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function settingsToApi(r) {
  return {
    firmName: r.firm_name,
    loanPeriodDays: r.loan_period_days,
    renewalLengthDays: r.renewal_length_days,
    allowRenewals: !!r.allow_renewals,
  };
}

function safeJsonArray(value) {
  try {
    const v = JSON.parse(value || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function nowIso() {
  return new Date().toISOString();
}
