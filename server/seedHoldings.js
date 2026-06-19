/* ============================================================================
 * Seed the IGP holdings into the catalogue — books + the NWLR serial run.
 *
 * Loads every book record from the master holdings spreadsheet AS ALREADY
 * REGISTERED, creates the single NWLR serial record, and seeds the NWLR Parts
 * dataset (1 → upper bound) marking the 1,233 not-held Parts as Missing.
 *
 * Idempotent and safe to re-run:
 *   - a row whose accession number already exists is skipped;
 *   - a content-duplicate (title+authors+edition+publisher+collection) rolls
 *     its copies into the existing record;
 *   - NWLR Parts are only seeded when the dataset is empty (so later
 *     Missing -> Held flips by the Librarian are preserved).
 *
 * Usage:
 *   node server/seedHoldings.js "/path/to/IGP_Library_Catalogue.xlsx"
 * ========================================================================== */

import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, nextId, ensureCounterAtLeast, parseIdNumber } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
if (!file) {
  console.error('Usage: node server/seedHoldings.js <path-to-catalogue.xlsx>');
  process.exit(1);
}

// --- Controlled vocabularies & rules ---------------------------------------
const GROUPING_MAP = {
  '1. textbooks': 'Textbooks',
  '2. laws / statutes': 'Laws / Statutes',
  '3. legal books, essays & commentaries': 'Legal Books / Essays / Commentaries',
  '4. law reports': 'Law Reports',
  '5. reference collections': 'Reference Collections',
};
// Firm authorship is set explicitly by the Librarian; nothing is auto-tagged.
const norm = (v) => String(v ?? '').trim().toLowerCase();
const firmAuthored = () => false;

function mapGrouping(raw) {
  const key = norm(raw);
  if (GROUPING_MAP[key]) return GROUPING_MAP[key];
  // Tolerant fallback: match on the descriptive part.
  if (key.includes('textbook')) return 'Textbooks';
  if (key.includes('statute') || key.includes('law')) return 'Laws / Statutes';
  if (key.includes('essay') || key.includes('commentar')) return 'Legal Books / Essays / Commentaries';
  if (key.includes('report')) return 'Law Reports';
  if (key.includes('reference')) return 'Reference Collections';
  return null; // flagged
}

// Standing author/publisher rules from the import brief.
function applyStandingRules(rec) {
  const t = norm(rec.title);
  const a = norm(rec.authors);

  // Olakanmi compilations always carry "Olajide Olakanmi".
  if (a.includes('olakanmi') || t.includes('olakanmi')) rec.authors = 'Olajide Olakanmi';

  // Nigerian Law School handbooks carry the Council of Legal Education.
  if (a.includes('nigerian law school') || a.includes('council of legal education') ||
      (!rec.authors && (t.includes('law school') || t.includes('bar part') || t.includes('bar final')))) {
    rec.authors = 'Council of Legal Education, Nigerian Law School';
  }

  // Standardise every Princeton variant.
  if (norm(rec.publisher).includes('princeton')) rec.publisher = 'Princeton & Associates Publishing Co. Ltd';

  return rec;
}

// --- Read the spreadsheet ---------------------------------------------------
const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
const ws = wb.Sheets['Catalogue'] || wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
// Header is the row containing "Accession No." / "Title".
const headerIdx = aoa.findIndex((r) => r && r.some((c) => norm(c) === 'title'));
if (headerIdx < 0) { console.error('Could not find a header row with a "Title" column.'); process.exit(1); }
const headers = aoa[headerIdx].map((h) => norm(h));
const col = (name) => headers.indexOf(name);
const idx = {
  accession: col('accession no.'), authors: col('author(s)'), title: col('title'),
  edition: col('edition'), publisher: col('publisher'), year: col('year'),
  grouping: col('grouping'), copies: col('copies'), acquired: col('date acquired'),
  status: col('status'), notes: col('notes'),
};
const dataRows = aoa.slice(headerIdx + 1).filter((r) => r && r[idx.title]);

// --- Prepared statements ----------------------------------------------------
const findByAccession = db.prepare('SELECT * FROM catalogue WHERE accession_number = ?');
const allCatalogue = db.prepare('SELECT * FROM catalogue');
const insertCatalogue = db.prepare(
  `INSERT INTO catalogue
     (accession_number, title, authors, publisher, edition, year, isbn, issn,
      grouping, collection, copies_total, copies_available, status,
      firm_authorship, keywords, shelf_location, acquisition_date, volume, part, notes)
   VALUES (@accession_number,@title,@authors,@publisher,@edition,@year,@isbn,@issn,
      @grouping,@collection,@copies_total,@copies_available,@status,
      @firm_authorship,@keywords,@shelf_location,@acquisition_date,@volume,@part,@notes)`
);
const raiseCopies = db.prepare(
  `UPDATE catalogue SET copies_total = copies_total + ?, copies_available = copies_available + ?,
     updated_at = datetime('now') WHERE id = ?`
);

const dupKey = (r) =>
  [norm(r.title), norm(r.authors), norm(r.edition), norm(r.publisher), norm(r.collection)].join('||');

// --- Load books -------------------------------------------------------------
const report = {
  added: 0, merged: 0, skipped: 0, flagged: [],
  toSupplyAuthor: [], toSupplyPublisher: [],
  byGrouping: {}, byCollection: {}, copies: 0, accessions: [],
};

const seedBooks = db.transaction(() => {
  const existing = allCatalogue.all();
  const byKey = new Map(existing.map((r) => [dupKey(r), r]));

  for (const row of dataRows) {
    const grouping = mapGrouping(row[idx.grouping]);
    const accession = String(row[idx.accession] || '').trim();
    const title = String(row[idx.title] || '').trim();

    if (!grouping) { report.flagged.push({ accession, title, reason: 'No valid grouping' }); continue; }

    let rec = {
      accession_number: accession,
      title,
      authors: String(row[idx.authors] ?? '').trim(),
      publisher: String(row[idx.publisher] ?? '').trim(),
      edition: String(row[idx.edition] ?? '').trim(),
      year: String(row[idx.year] ?? '').trim(),
      grouping,
      collection: 'Izy Global Partners LLP',
      copies: Math.max(1, parseInt(row[idx.copies], 10) || 1),
      acquisition_date: normaliseDate(row[idx.acquired]),
      status: norm(row[idx.status]) === 'on shelf' || !row[idx.status] ? 'Available' : titleCaseStatus(row[idx.status]),
      notes: String(row[idx.notes] ?? '').trim(),
    };
    rec = applyStandingRules(rec);

    // Blank author/publisher are loaded and marked "To supply" — never invented.
    if (!rec.authors) { rec.authors = 'To supply'; report.toSupplyAuthor.push(`${accession} — ${title}`); }
    if (!rec.publisher) { rec.publisher = 'To supply'; report.toSupplyPublisher.push(`${accession} — ${title}`); }

    // Idempotency: skip if this accession is already loaded.
    if (accession && findByAccession.get(accession)) { report.skipped += 1; continue; }

    // Content duplicate -> roll copies into the existing record.
    const match = byKey.get(dupKey(rec));
    if (match) {
      raiseCopies.run(rec.copies, rec.copies, match.id);
      report.merged += 1;
      continue;
    }

    if (accession) {
      const n = parseIdNumber(accession);
      if (Number.isFinite(n)) ensureCounterAtLeast('accession', n);
    }
    const accNo = accession || nextId('accession');
    const full = {
      accession_number: accNo,
      title: rec.title,
      authors: rec.authors,
      publisher: rec.publisher,
      edition: rec.edition,
      year: rec.year,
      isbn: '', issn: '',
      grouping: rec.grouping,
      collection: rec.collection,
      copies_total: rec.copies,
      copies_available: rec.status === 'Reference only' ? 0 : rec.copies,
      status: rec.status,
      firm_authorship: firmAuthored(rec.title) ? 1 : 0,
      keywords: '[]',
      shelf_location: '',
      acquisition_date: rec.acquisition_date,
      volume: '', part: '',
      notes: rec.notes,
    };
    insertCatalogue.run(full);
    byKey.set(dupKey(rec), { ...full, id: -1 });
    report.added += 1;
    report.accessions.push(accNo);
    report.byGrouping[grouping] = (report.byGrouping[grouping] || 0) + 1;
    report.byCollection[rec.collection] = (report.byCollection[rec.collection] || 0) + 1;
    report.copies += rec.copies;
  }
});
seedBooks();

// --- NWLR serial record -----------------------------------------------------
const NWLR_TITLE = 'Nigerian Weekly Law Reports (NWLR)';
let nwlrRow = db.prepare('SELECT * FROM catalogue WHERE title = ?').get(NWLR_TITLE);
if (!nwlrRow) {
  const accNo = nextId('accession');
  insertCatalogue.run({
    accession_number: accNo,
    title: NWLR_TITLE,
    authors: 'Editorial Board, Nigerian Weekly Law Reports (founding editor-in-chief: Chief Gani Fawehinmi)',
    publisher: 'Nigerian Law Publications Ltd — to confirm',
    edition: '', year: '', isbn: '', issn: '',
    grouping: 'Law Reports',
    collection: 'Izy Global Partners LLP',
    copies_total: 1, copies_available: 0,
    status: 'Reference only',
    firm_authorship: 0, keywords: '[]', shelf_location: '',
    acquisition_date: null, volume: '', part: '',
    notes: 'Serial run. Individual Parts tracked in the NWLR Holdings Status view (held vs missing).',
  });
  nwlrRow = db.prepare('SELECT * FROM catalogue WHERE title = ?').get(NWLR_TITLE);
}
db.prepare('UPDATE nwlr_config SET serial_accession = ? WHERE id = 1').run(nwlrRow.accession_number);

// --- NWLR Parts dataset (seed only if empty) --------------------------------
const MISSING = buildMissingSet();
if (MISSING.size !== 1233) {
  console.error(`NWLR missing set is ${MISSING.size}, expected 1233 — STOPPING (no Parts written).`);
  process.exit(1);
}
// The run is currently held through Part 2043 (Parts 1999–2043 added as Held);
// the firm has confirmed this bound, so it is no longer provisional.
const NWLR_UPPER = 2043;
db.prepare('UPDATE nwlr_config SET upper_bound = ?, upper_provisional = 0 WHERE id = 1').run(NWLR_UPPER);
const cfg = db.prepare('SELECT * FROM nwlr_config WHERE id = 1').get();
const upper = cfg.upper_bound;
const existingParts = db.prepare('SELECT COUNT(*) n FROM nwlr_parts').get().n;
let partsSeeded = 0;
if (existingParts === 0) {
  const insPart = db.prepare('INSERT INTO nwlr_parts (part_no, status) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (let p = 1; p <= upper; p += 1) insPart.run(p, MISSING.has(p) ? 'Missing' : 'Held');
  });
  tx();
  partsSeeded = upper;
}
const heldCount = db.prepare("SELECT COUNT(*) n FROM nwlr_parts WHERE status='Held'").get().n;
const missingCount = db.prepare("SELECT COUNT(*) n FROM nwlr_parts WHERE status='Missing'").get().n;

// --- Totals -----------------------------------------------------------------
const totalTitles = db.prepare('SELECT COUNT(*) n FROM catalogue').get().n;
const totalCopies = db.prepare('SELECT COALESCE(SUM(copies_total),0) n FROM catalogue').get().n;
const groupingCounts = db.prepare('SELECT grouping, COUNT(*) n FROM catalogue GROUP BY grouping').all();
const collectionCounts = db.prepare('SELECT collection, COUNT(*) n FROM catalogue GROUP BY collection').all();
const accRange = db.prepare('SELECT MIN(accession_number) lo, MAX(accession_number) hi FROM catalogue').get();
const statutes = db.prepare("SELECT COUNT(*) n FROM catalogue WHERE grouping='Laws / Statutes'").get().n;

// --- Console summary ---------------------------------------------------------
console.log('\n=== IGP holdings seed — summary ===');
console.log(`Books: ${report.added} added, ${report.merged} merged as copies, ${report.skipped} skipped (already loaded).`);
if (report.flagged.length) console.log(`Flagged (no grouping): ${report.flagged.length}`);
console.log(`NWLR serial: ${nwlrRow.accession_number} (1 title). Parts seeded: ${partsSeeded || '(already present)'}.`);
console.log(`NWLR Parts — Held: ${heldCount}, Missing: ${missingCount} (target missing 1233).`);
console.log(`\nCatalogue totals — titles: ${totalTitles}, copies: ${totalCopies}.`);
console.log('By grouping:', groupingCounts.map((g) => `${g.grouping}=${g.n}`).join(', '));
console.log('By collection:', collectionCounts.map((c) => `${c.collection}=${c.n}`).join(', '));
console.log(`Accession range: ${accRange.lo} … ${accRange.hi}`);
console.log(`Laws / Statutes count: ${statutes} (register total expected 33${statutes === 32 ? ' — ONE SHORT' : statutes === 33 ? ' — reconciles' : ''}).`);
console.log(`Author "To supply": ${report.toSupplyAuthor.length}; Publisher "To supply": ${report.toSupplyPublisher.length}.`);

// --- IMPORT-NOTES.md --------------------------------------------------------
const notes = `# IGP Library — Import Notes

_Generated ${new Date().toISOString().slice(0, 10)} by \`server/seedHoldings.js\`._

## Source
- Book catalogue: \`${file.split('/').pop()}\` (sheet "Catalogue").
- NWLR run: missing-Parts list embedded in \`IGP-LMS-Data-Import-Prompt-v2.md\`.

## Totals
- **Catalogue titles:** ${totalTitles} (includes the single NWLR serial record; NWLR Parts do **not** inflate this).
- **Physical copies:** ${totalCopies}.
- **By grouping:** ${groupingCounts.map((g) => `${g.grouping} — ${g.n}`).join('; ')}.
- **By collection:** ${collectionCounts.map((c) => `${c.collection} — ${c.n}`).join('; ')}.
- **Accession range:** ${accRange.lo} … ${accRange.hi}.
- **NWLR:** Held ${heldCount} · Missing ${missingCount} · run held through Part ${upper} (confirmed; Parts 1999–${upper} held).

## This run
- Books added: ${report.added}; merged as extra copies: ${report.merged}; skipped (already loaded): ${report.skipped}.
- NWLR serial record: ${nwlrRow.accession_number}.
- NWLR Parts seeded: ${partsSeeded || 'already present (left untouched)'}.

## Reconciliation
- Laws / Statutes: ${statutes} record(s). Register total expected **33**${statutes === 33 ? ' — reconciles.' : statutes < 33 ? ` — **${33 - statutes} short** of the register; review.` : ` — ${statutes - 33} more than the register; review.`}

## Exceptions — fields marked "To supply" (load, do not invent)
### Author to supply (${report.toSupplyAuthor.length})
${report.toSupplyAuthor.map((s) => `- ${s}`).join('\n') || '- none'}

### Publisher to supply (${report.toSupplyPublisher.length})
${report.toSupplyPublisher.map((s) => `- ${s}`).join('\n') || '- none'}

${report.flagged.length ? `### Rows flagged (no grouping)\n${report.flagged.map((f) => `- ${f.accession} ${f.title}`).join('\n')}\n` : ''}
## Open NWLR items (surface, not resolved)
1. **Upper limit of the run** — confirmed held through Part ${upper} (Parts 1999–${upper} added as Held). Raise it further in the NWLR Holdings Status view as later Parts are acquired.
2. **Publisher imprint** — recorded as "Nigerian Law Publications Ltd — to confirm".
3. **Source fragment "1246–1347" — RESOLVED:** confirmed by the firm to be **1346–1347** (not 1246–1347). The dataset already records 1346–1347 as missing and still reconciles to exactly 1,233 missing Parts.
`;
writeFileSync(resolve(__dirname, '..', 'IMPORT-NOTES.md'), notes);
console.log('\nWrote IMPORT-NOTES.md');
process.exit(0);

// --- helpers ----------------------------------------------------------------
function buildMissingSet() {
  const bands = [
    '2-20, 22, 24, 27-28, 30, 32, 34-38, 43, 49, 51-53, 55-57, 63, 69, 72, 74, 76, 84, 93, 98-101, 109, 111, 114, 116, 119, 127, 129, 131, 133-134, 137, 140-142, 156-157, 159, 161-164, 166-341, 345-347, 355, 360, 366, 370, 374, 377, 382-383, 387-391, 393, 397, 406, 411, 414-417, 430, 436, 460-500',
    '501-1000',
    '1001-1039, 1046, 1048, 1051, 1067-1068, 1074, 1081-1082, 1087, 1089, 1093-1095, 1098-1099, 1119, 1144, 1156, 1173, 1177, 1185, 1193-1194, 1196-1197, 1204-1205, 1218, 1224, 1228, 1243-1244, 1246-1248, 1250, 1254, 1259, 1261-1262, 1268, 1277, 1279, 1282-1284, 1286, 1291, 1293, 1302, 1304, 1306-1309, 1325, 1330, 1336-1337, 1341, 1346-1347, 1350, 1361, 1363, 1373, 1376, 1390, 1393, 1421-1500',
    '1501-1550, 1553, 1555-1558, 1561-1562, 1564, 1569, 1572, 1574, 1579, 1582, 1587, 1590-1593, 1597, 1601, 1607, 1612, 1623-1627, 1629-1634, 1640, 1645-1647, 1649-1651, 1654-1656, 1662, 1666, 1669-1670, 1673, 1675-1676, 1678-1682, 1686, 1691-1695, 1701-1709, 1721-1722, 1724-1730, 1734-1736, 1739-1744, 1747-1748, 1751, 1753-1759, 1761-1763, 1767, 1770-1773, 1775, 1777-1778, 1780, 1782, 1784-1785, 1787, 1801-1810, 1813-1814, 1819-1821, 1823-1824, 1826-1827, 1833, 1837, 1839, 1842, 1844-1846, 1849-1859, 1861-1862, 1865-1870, 1872-1873, 1875, 1877, 1879-1880, 1890-1897, 1899, 1901, 1905, 1909, 1916, 1958, 1966, 1984, 1998',
  ];
  const set = new Set();
  for (const band of bands) {
    for (const tok of band.split(',').map((t) => t.trim())) {
      if (tok.includes('-')) { const [a, b] = tok.split('-').map(Number); for (let i = a; i <= b; i += 1) set.add(i); }
      else set.add(Number(tok));
    }
  }
  return set;
}

function normaliseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function titleCaseStatus(v) {
  const s = norm(v);
  if (s.includes('reference')) return 'Reference only';
  if (s.includes('missing')) return 'Missing';
  if (s.includes('withdrawn')) return 'Withdrawn';
  if (s.includes('loan')) return 'On loan';
  return 'Available';
}
