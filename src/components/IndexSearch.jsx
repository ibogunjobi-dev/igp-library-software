// Searchable index entries for a law report series. The Librarian can search
// the available indexes and add new ones (the index data is added over time).
import { useEffect, useState } from 'react';
import { searchSeriesIndexes, addSeriesIndex } from '../lib/lawreports';
import { exportToExcel } from '../lib/excel';
import DataTable from './DataTable';

export default function IndexSearch({ seriesId, seriesAbbr }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(null);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', reference: '', keywords: '', notes: '' });
  const [busy, setBusy] = useState(false);

  async function run(query) {
    try {
      const data = await searchSeriesIndexes(seriesId, query);
      setRows(data);
      if (!query) setCount(data.length);
    } catch (err) {
      setError(err.message || 'Index search failed.');
    }
  }
  useEffect(() => { run(''); /* initial load = full list + count */ }, [seriesId]);

  function onSearch(e) { e.preventDefault(); run(q.trim()); }

  async function onAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await addSeriesIndex(seriesId, form);
      setForm({ title: '', reference: '', keywords: '', notes: '' });
      setShowAdd(false);
      await run(q.trim());
      setCount((c) => (c == null ? c : c + 1));
    } catch (err) {
      setError(err.message || 'Could not add index entry.');
    } finally {
      setBusy(false);
    }
  }

  function exportIndexes() {
    exportToExcel(rows, {
      filename: `IGP-${seriesAbbr || 'law-report'}-indexes`,
      sheetName: 'Indexes',
      columns: [
        { key: 'title', label: 'Index entry' },
        { key: 'reference', label: 'Reference' },
        { key: 'keywords', label: 'Keywords' },
        { key: 'notes', label: 'Notes' },
      ],
    });
  }

  return (
    <div className="panel">
      <div className="spread">
        <h2 className="panel__title" style={{ margin: 0 }}>
          Indexes {count != null && <span className="muted text-small">({count} available)</span>}
        </h2>
        <div className="row">
          <button className="btn btn--ghost btn--sm" onClick={exportIndexes} disabled={!rows.length}>Export</button>
          <button className="btn btn--sm" onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Cancel' : 'Add index'}</button>
        </div>
      </div>

      {error && <div className="alert alert--error mt-1">{error}</div>}

      <form className="toolbar mt-2" onSubmit={onSearch} style={{ marginBottom: 0 }}>
        <div className="field toolbar__search">
          <label>Search this report's indexes</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Subject, case name, reference, keyword…" />
        </div>
        <button className="btn" type="submit">Search</button>
        {q && <button className="btn btn--ghost" type="button" onClick={() => { setQ(''); run(''); }}>Clear</button>}
      </form>

      {showAdd && (
        <form className="form-grid mt-3" onSubmit={onAdd}>
          <div className="field field--full">
            <label>Index entry<span className="req">*</span></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="field">
            <label>Reference (volume / part / page)</label>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div className="field">
            <label>Keywords</label>
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
          </div>
          <div className="field field--full">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-actions field--full">
            <button className="btn" type="submit" disabled={busy}>Save index entry</button>
          </div>
        </form>
      )}

      <div className="mt-3">
        {rows.length === 0 && count === 0 ? (
          <p className="muted" style={{ padding: '0.5rem 0' }}>
            No indexes have been added for this report yet. Use &ldquo;Add index&rdquo; to start building them.
          </p>
        ) : (
          <DataTable
            rows={rows}
            pageSize={10}
            emptyMessage="No index entries match your search."
            columns={[
              { key: 'title', label: 'Index entry', sortable: true },
              { key: 'reference', label: 'Reference', render: (r) => r.reference || <span className="muted">—</span> },
              { key: 'keywords', label: 'Keywords', render: (r) => r.keywords || <span className="muted">—</span> },
              { key: 'notes', label: 'Notes', render: (r) => r.notes || <span className="muted">—</span> },
            ]}
          />
        )}
      </div>
    </div>
  );
}
