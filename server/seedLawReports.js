/* ============================================================================
 * Seed / migrate law-report series.
 *
 *  - Registers NWLR as a 'parts' series linked to its catalogue record.
 *  - Creates the LRECN ('Law Reports of Election Cases of Nigeria') series and
 *    its held volumes.
 *  - Adds the two Izinyon electoral-law textbooks to the catalogue.
 *
 * Idempotent and additive: it never deletes or overwrites the Librarian's
 * existing records (matches before inserting). Safe to re-run.
 *
 * Usage:  node server/seedLawReports.js
 * ========================================================================== */

import { db, nextId } from './db.js';

const norm = (v) => String(v ?? '').trim().toLowerCase();

// --- NWLR series (Part-based) ----------------------------------------------
const nwlrCfg = db.prepare('SELECT serial_accession FROM nwlr_config WHERE id = 1').get();
let nwlr = db.prepare("SELECT * FROM law_report_series WHERE abbreviation='NWLR'").get();
if (!nwlr) {
  db.prepare(
    `INSERT INTO law_report_series (abbreviation, name, kind, serial_accession, description, sort_order)
     VALUES ('NWLR', 'Nigerian Weekly Law Reports (NWLR)', 'parts', ?, 'General law reports — tracked Part by Part.', 10)`
  ).run(nwlrCfg?.serial_accession || null);
  console.log('NWLR series registered.');
} else {
  console.log('NWLR series already present.');
}

// --- LRECN series (volume-based) -------------------------------------------
let lrecn = db.prepare("SELECT * FROM law_report_series WHERE abbreviation='LRECN'").get();
if (!lrecn) {
  const accession = nextId('accession');
  db.prepare(
    `INSERT INTO catalogue (accession_number, title, authors, grouping, collection,
        copies_total, copies_available, status, notes)
     VALUES (?, 'Law Reports of Election Cases of Nigeria (LRECN)', '', 'Law Reports',
        'Izy Global Partners LLP', 1, 0, 'Reference only', 'Law report serial — LRECN; volumes tracked individually.')`
  ).run(accession);
  const info = db.prepare(
    `INSERT INTO law_report_series (abbreviation, name, kind, serial_accession, description, sort_order)
     VALUES ('LRECN', 'Law Reports of Election Cases of Nigeria (LRECN)', 'volumes', ?, 'Election-cases law reports — tracked by volume.', 20)`
  ).run(accession);
  lrecn = db.prepare('SELECT * FROM law_report_series WHERE id=?').get(info.lastInsertRowid);
  console.log(`LRECN series created (catalogue ${accession}).`);
} else {
  console.log('LRECN series already present.');
}

// LRECN held volumes, in the order supplied by the firm.
const LRECN_VOLUMES = [
  { label: '1960–1980 — LRECN', year: '1960–1980', volume: '' },
  { label: '1981–1990 — LRECN', year: '1981–1990', volume: '' },
  { label: '1991 — LRECN', year: '1991', volume: '' },
  { label: '1992 — LRECN 1', year: '1992', volume: '1' },
  { label: '1992 — LRECN 2', year: '1992', volume: '2' },
  { label: '1992 — LRECN 3', year: '1992', volume: '3' },
  { label: '1992 — LRECN 4', year: '1992', volume: '4' },
  { label: '2000–2002 — LRECN', year: '2000–2002', volume: '' },
  { label: '2003 — LRECN 1', year: '2003', volume: '1' },
  { label: '2003 — LRECN 2', year: '2003', volume: '2' },
  { label: '2003 — LRECN 3', year: '2003', volume: '3' },
  { label: '2004 — LRECN 4', year: '2004', volume: '4' },
  { label: '2004 — LRECN 2', year: '2004', volume: '2' },
  { label: '2005 — LRECN 1', year: '2005', volume: '1' },
  { label: '2005 — LRECN 2', year: '2005', volume: '2' },
  { label: '2006 — LRECN', year: '2006', volume: '' },
  { label: '2007 — LRECN', year: '2007', volume: '' },
  { label: '2008 — LRECN 1', year: '2008', volume: '1' },
  { label: '2008 — LRECN 2', year: '2008', volume: '2' },
  { label: '2008 — LRECN 3', year: '2008', volume: '3' },
  { label: '2008 — LRECN 4', year: '2008', volume: '4' },
  { label: '2009 — LRECN 1', year: '2009', volume: '1' },
  { label: '2009 — LRECN 2', year: '2009', volume: '2' },
  { label: '2009 — LRECN 3', year: '2009', volume: '3' },
  { label: '2010 — LRECN', year: '2010', volume: '' },
  { label: '2011 — LRECN 1', year: '2011', volume: '1' },
  { label: '2011 — LRECN 2', year: '2011', volume: '2' },
  { label: '2011 — LRECN 3', year: '2011', volume: '3' },
  { label: '2011 — LRECN 4', year: '2011', volume: '4' },
  { label: '2012 — LRECN 1', year: '2012', volume: '1' },
  { label: '2012 — LRECN 2', year: '2012', volume: '2' },
  { label: '2013 — LRECN', year: '2013', volume: '' },
];

const existingVols = db.prepare('SELECT COUNT(*) n FROM law_report_volumes WHERE series_id=?').get(lrecn.id).n;
if (existingVols === 0) {
  const ins = db.prepare(
    "INSERT INTO law_report_volumes (series_id, label, year, volume, status, sort_order) VALUES (?,?,?,?, 'Held', ?)"
  );
  const tx = db.transaction(() => LRECN_VOLUMES.forEach((v, i) => ins.run(lrecn.id, v.label, v.year, v.volume, i + 1)));
  tx();
  console.log(`LRECN volumes seeded: ${LRECN_VOLUMES.length} (all Held).`);
} else {
  console.log(`LRECN volumes already present (${existingVols}); left untouched.`);
}

// --- Two electoral-law textbooks -------------------------------------------
// Authored by the firm's principal, Alex A. Izinyon SAN — tagged firm-authored.
const TEXTBOOKS = [
  {
    title: 'Electoral Law and Practice Procedure (Elections and Other Matters, Volume 1)',
    authors: 'Alex A. Izinyon SAN; Charles I. Ndukwe Esq.',
    publisher: 'Acavi Publishers',
    copies: 2,
  },
  {
    title: 'Electoral Law and Practice Procedure (Election Petition, Volume 2)',
    authors: 'Alex A. Izinyon SAN; Charles I. Ndukwe Esq.',
    publisher: 'Acavi Publishers',
    copies: 2,
  },
];

let added = 0;
for (const t of TEXTBOOKS) {
  const dup = db.prepare('SELECT id FROM catalogue WHERE lower(title)=? AND lower(authors)=?')
    .get(norm(t.title), norm(t.authors));
  if (dup) { console.log(`Textbook already present: ${t.title}`); continue; }
  const accession = nextId('accession');
  db.prepare(
    `INSERT INTO catalogue (accession_number, title, authors, publisher, grouping, collection,
        copies_total, copies_available, status, firm_authorship)
     VALUES (?, ?, ?, ?, 'Textbooks', 'Izy Global Partners LLP', ?, ?, 'Available', 1)`
  ).run(accession, t.title, t.authors, t.publisher, t.copies, t.copies);
  console.log(`Textbook added: ${accession} — ${t.title} (${t.copies} copies, firm-authored).`);
  added += 1;
}

console.log(`\nDone. Textbooks added this run: ${added}.`);
process.exit(0);
