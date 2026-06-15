// ============================================================================
// Spreadsheet importer (SheetJS).
//
// Flow: upload -> map columns to catalogue fields -> validate & preview
//       (with duplicate detection) -> bulk insert.
//
// No fixed column layout is assumed: the Librarian maps the existing holdings
// spreadsheet's own headings to catalogue fields. Existing accession numbers
// are preserved; absent ones are generated. The Founder/Chairman's two authored
// titles are pre-tagged firmAuthorship on insert (handled in lib/catalogue).
// ============================================================================

import { useMemo, useState } from 'react';
import { parseSpreadsheet } from '../../lib/excel';
import {
  getAllCatalogue,
  createCatalogueItem,
  incrementCopies,
  findDuplicate,
} from '../../lib/catalogue';
import {
  GROUPINGS,
  COLLECTIONS,
  CATALOGUE_STATUSES,
  DEFAULT_COLLECTION,
  FIRM_AUTHORED_TITLES,
} from '../../lib/constants';
import { norm, authorsToDisplay } from '../../lib/format';
import Spinner from '../../components/Spinner';

// Catalogue fields the importer can target, with header-matching aliases.
const TARGET_FIELDS = [
  { key: 'accessionNumber', label: 'Accession number', aliases: ['accession', 'acc no', 'acc', 'accession number', 'igp'] },
  { key: 'title', label: 'Title', required: true, aliases: ['title', 'book title', 'name'] },
  { key: 'authors', label: 'Author(s)', aliases: ['author', 'authors', 'by'] },
  { key: 'publisher', label: 'Publisher', aliases: ['publisher', 'publishers', 'pub'] },
  { key: 'edition', label: 'Edition', aliases: ['edition', 'edn', 'ed'] },
  { key: 'year', label: 'Year', aliases: ['year', 'date', 'yr'] },
  { key: 'isbn', label: 'ISBN', aliases: ['isbn'] },
  { key: 'issn', label: 'ISSN', aliases: ['issn'] },
  { key: 'grouping', label: 'Grouping', aliases: ['grouping', 'group', 'category', 'class'] },
  { key: 'collection', label: 'Collection', aliases: ['collection'] },
  { key: 'copiesTotal', label: 'Total copies', aliases: ['copies', 'copy', 'qty', 'quantity', 'no of copies'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'keywords', label: 'Keywords', aliases: ['keywords', 'tags', 'subject'] },
  { key: 'shelfLocation', label: 'Shelf location', aliases: ['shelf', 'location', 'shelf location'] },
  { key: 'acquisitionDate', label: 'Acquisition date', aliases: ['acquisition', 'acquired', 'acquisition date'] },
  { key: 'volume', label: 'Volume', aliases: ['volume', 'vol'] },
  { key: 'part', label: 'Part', aliases: ['part', 'pt'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks', 'comment'] },
];

const STEPS = { UPLOAD: 'upload', MAP: 'map', PREVIEW: 'preview', DONE: 'done' };

export default function ImportPage() {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({}); // fieldKey -> header
  const [defaultGrouping, setDefaultGrouping] = useState(GROUPINGS[0]);
  const [defaultCollection, setDefaultCollection] = useState(DEFAULT_COLLECTION);

  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);

  // --- Step 1: upload & parse ---------------------------------------------
  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const { headers: h, rows: r } = await parseSpreadsheet(file);
      if (!h.length) { setError('No header row found in the spreadsheet.'); return; }
      setHeaders(h);
      setRows(r);
      setMapping(autoMap(h));
      setStep(STEPS.MAP);
    } catch (err) {
      setError(err.message || 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  }

  // --- Step 2 -> 3: build candidate records and analyse -------------------
  async function analyse() {
    setError('');
    if (!mapping.title) { setError('Map a column to the required Title field.'); return; }
    setBusy(true);
    try {
      const existing = await getAllCatalogue();
      const built = [];
      const errors = [];
      const batchSeen = []; // for in-file duplicate roll-up

      rows.forEach((row, i) => {
        const rec = buildRecord(row, mapping, defaultGrouping, defaultCollection);
        if (!rec.title) {
          errors.push({ line: i + 2, message: 'Missing title — row skipped.' });
          return;
        }
        // Duplicate against existing catalogue?
        const existingDup = findDuplicate(existing, rec);
        const batchDup = findDuplicate(batchSeen, rec);
        let action = 'create';
        if (existingDup) action = 'increment-existing';
        else if (batchDup) action = 'increment-batch';
        else batchSeen.push(rec);

        built.push({ line: i + 2, rec, action, existingDup });
      });

      setAnalysis({
        built,
        errors,
        counts: {
          create: built.filter((b) => b.action === 'create').length,
          increment: built.filter((b) => b.action !== 'create').length,
          errors: errors.length,
          firm: built.filter((b) => isFirmAuthored(b.rec.title)).length,
          preserved: built.filter((b) => b.rec.accessionNumber).length,
        },
      });
      setStep(STEPS.PREVIEW);
    } catch (err) {
      setError(err.message || 'Failed to analyse the spreadsheet.');
    } finally {
      setBusy(false);
    }
  }

  // --- Step 3 -> 4: commit -------------------------------------------------
  async function commit() {
    setBusy(true);
    setError('');
    let created = 0, incremented = 0, failed = 0;
    try {
      // Track records created in this run so in-file duplicates roll up too.
      const createdThisRun = [];
      for (const item of analysis.built) {
        try {
          if (item.action === 'increment-existing' && item.existingDup) {
            await incrementCopies(item.existingDup.id, item.rec.copiesTotal || 1);
            incremented += 1;
          } else if (item.action === 'increment-batch') {
            const match = findDuplicate(createdThisRun, item.rec);
            if (match) {
              await incrementCopies(match.id, item.rec.copiesTotal || 1);
              incremented += 1;
            } else {
              const c = await createCatalogueItem(item.rec, { preserveAccession: item.rec.accessionNumber || null });
              createdThisRun.push(c);
              created += 1;
            }
          } else {
            const c = await createCatalogueItem(item.rec, { preserveAccession: item.rec.accessionNumber || null });
            createdThisRun.push(c);
            created += 1;
          }
        } catch {
          failed += 1;
        }
      }
      setResult({ created, incremented, failed });
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep(STEPS.UPLOAD);
    setHeaders([]); setRows([]); setMapping({});
    setAnalysis(null); setResult(null); setError('');
  }

  return (
    <>
      <div className="page-head">
        <h1>Import holdings</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {busy && <Spinner center />}

      {!busy && step === STEPS.UPLOAD && (
        <div className="panel">
          <h2 className="panel__title">Step 1 — Upload spreadsheet</h2>
          <p className="text-small muted">
            Upload the existing holdings spreadsheet (<code>.xlsx</code> or{' '}
            <code>.csv</code>). The first sheet's first row is treated as the
            column headings. You will map those headings to catalogue fields on
            the next step.
          </p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="mt-1" />
        </div>
      )}

      {!busy && step === STEPS.MAP && (
        <MapStep
          headers={headers}
          rows={rows}
          mapping={mapping}
          setMapping={setMapping}
          defaultGrouping={defaultGrouping}
          setDefaultGrouping={setDefaultGrouping}
          defaultCollection={defaultCollection}
          setDefaultCollection={setDefaultCollection}
          onBack={reset}
          onNext={analyse}
        />
      )}

      {!busy && step === STEPS.PREVIEW && analysis && (
        <PreviewStep analysis={analysis} onBack={() => setStep(STEPS.MAP)} onCommit={commit} />
      )}

      {!busy && step === STEPS.DONE && result && (
        <div className="panel">
          <h2 className="panel__title">Import complete</h2>
          <div className="alert alert--ok">
            {result.created} new record{result.created === 1 ? '' : 's'} created;{' '}
            {result.incremented} rolled up into existing records as added copies;{' '}
            {result.failed} failed.
          </div>
          <button className="btn" onClick={reset}>Import another file</button>
        </div>
      )}
    </>
  );
}

// --- Mapping step component -------------------------------------------------
function MapStep({
  headers, rows, mapping, setMapping,
  defaultGrouping, setDefaultGrouping,
  defaultCollection, setDefaultCollection,
  onBack, onNext,
}) {
  const sample = rows.slice(0, 5);
  return (
    <>
      <div className="panel">
        <h2 className="panel__title">Step 2 — Map columns to catalogue fields</h2>
        <p className="text-small muted">
          For each catalogue field, choose the spreadsheet column it should be
          read from. Title is required. Leave a field as “— not mapped —” to skip
          it. Accession numbers that are present will be preserved; rows without
          one will be assigned the next available number.
        </p>

        <div className="form-grid">
          {TARGET_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}{f.required && <span className="req">*</span>}</label>
              <select
                value={mapping[f.key] || ''}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
              >
                <option value="">— not mapped —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="form-grid mt-2">
          <div className="field">
            <label>Default grouping</label>
            <select value={defaultGrouping} onChange={(e) => setDefaultGrouping(e.target.value)}>
              {GROUPINGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <span className="field__hint">Used when a row has no valid grouping value.</span>
          </div>
          <div className="field">
            <label>Default collection</label>
            <select value={defaultCollection} onChange={(e) => setDefaultCollection(e.target.value)}>
              {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Preview — first {sample.length} of {rows.length} rows</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {sample.map((r, i) => (
                <tr key={i}>{headers.map((h) => <td key={h}>{String(r[h] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" onClick={onNext}>Validate &amp; preview import</button>
        <button className="btn btn--ghost" onClick={onBack}>Start over</button>
      </div>
    </>
  );
}

// --- Preview / confirm step -------------------------------------------------
// NOTE: This is the [CONFIRM BEFORE RUNNING] gate for the import — nothing is
// written to the catalogue until the Librarian presses "Run import" here.
function PreviewStep({ analysis, onBack, onCommit }) {
  const { built, errors, counts } = analysis;
  const preview = built.slice(0, 25);
  return (
    <>
      <div className="panel">
        <h2 className="panel__title">Step 3 — Confirm before running</h2>
        <div className="stat-grid">
          <Mini label="New records" value={counts.create} />
          <Mini label="Roll-ups (copies added)" value={counts.increment} />
          <Mini label="Accession numbers preserved" value={counts.preserved} />
          <Mini label="Firm-authored (pre-tagged)" value={counts.firm} />
          <Mini label="Rows skipped" value={counts.errors} />
        </div>
        {errors.length > 0 && (
          <div className="alert alert--info mt-2">
            {errors.length} row{errors.length === 1 ? '' : 's'} will be skipped (missing title).
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Preview — first {preview.length} of {built.length} records</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Action</th><th>Accession</th><th>Title</th><th>Author</th>
                <th>Edition</th><th>Grouping</th><th>Copies</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((b, i) => (
                <tr key={i}>
                  <td>
                    {b.action === 'create'
                      ? <span className="badge badge--available">New</span>
                      : <span className="badge badge--onloan">Add copies</span>}
                  </td>
                  <td>{b.rec.accessionNumber || <span className="muted">auto</span>}</td>
                  <td>
                    {b.rec.title}
                    {isFirmAuthored(b.rec.title) && <span className="badge badge--firm" style={{ marginLeft: 6 }}>Firm</span>}
                  </td>
                  <td>{authorsToDisplay(b.rec.authors) || <span className="muted">—</span>}</td>
                  <td>{b.rec.edition || <span className="muted">—</span>}</td>
                  <td>{b.rec.grouping}</td>
                  <td className="num">{b.rec.copiesTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" onClick={onCommit}>Run import</button>
        <button className="btn btn--ghost" onClick={onBack}>Back to mapping</button>
      </div>
    </>
  );
}

function Mini({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={{ fontSize: '1.6rem' }}>{value}</div>
    </div>
  );
}

// --- Helpers ----------------------------------------------------------------

function autoMap(headers) {
  const map = {};
  for (const f of TARGET_FIELDS) {
    const found = headers.find((h) => {
      const n = norm(h);
      return f.aliases.some((a) => n === a || n.includes(a));
    });
    if (found) map[f.key] = found;
  }
  return map;
}

function buildRecord(row, mapping, defaultGrouping, defaultCollection) {
  const get = (key) => {
    const header = mapping[key];
    return header ? row[header] : undefined;
  };
  const val = (key) => {
    const v = get(key);
    return v == null ? '' : String(v).trim();
  };

  // Grouping / collection must match the controlled vocabulary, else default.
  const rawGrouping = val('grouping');
  const grouping = GROUPINGS.find((g) => norm(g) === norm(rawGrouping)) || defaultGrouping;
  const rawCollection = val('collection');
  const collection = COLLECTIONS.find((c) => norm(c) === norm(rawCollection)) || defaultCollection;

  const rawStatus = val('status');
  const status = CATALOGUE_STATUSES.find((s) => norm(s) === norm(rawStatus)) || 'Available';

  const copiesRaw = parseInt(val('copiesTotal'), 10);
  const copiesTotal = Number.isFinite(copiesRaw) && copiesRaw > 0 ? copiesRaw : 1;

  return {
    accessionNumber: val('accessionNumber') || '',
    title: val('title'),
    authors: val('authors'),
    publisher: val('publisher'),
    edition: val('edition'),
    year: val('year'),
    isbn: val('isbn'),
    issn: val('issn'),
    grouping,
    collection,
    copiesTotal,
    status,
    keywords: val('keywords'),
    shelfLocation: val('shelfLocation'),
    acquisitionDate: val('acquisitionDate') || null,
    volume: val('volume'),
    part: val('part'),
    notes: val('notes'),
    firmAuthorship: isFirmAuthored(val('title')),
  };
}

function isFirmAuthored(title) {
  return FIRM_AUTHORED_TITLES.some((t) => norm(t) === norm(title));
}
