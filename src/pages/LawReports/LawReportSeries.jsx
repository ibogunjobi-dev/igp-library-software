// Volume-based law report series (e.g. LRECN) — held volumes + index search.
import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getLawReportSeries, addSeriesVolume, setVolumeStatus } from '../../lib/lawreports';
import { exportToExcel } from '../../lib/excel';
import IndexSearch from '../../components/IndexSearch';
import DataTable from '../../components/DataTable';
import Spinner from '../../components/Spinner';

export default function LawReportSeries() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', year: '', volume: '', status: 'Held' });

  async function load() {
    try { setData(await getLawReportSeries(id)); }
    catch (err) { setError(err.message || 'Failed to load the law report.'); }
  }
  useEffect(() => { load(); }, [id]);

  async function toggle(v) {
    setBusy(true);
    try { await setVolumeStatus(v.id, v.status === 'Held' ? 'Missing' : 'Held'); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!form.label.trim()) return;
    setBusy(true);
    try {
      await addSeriesVolume(id, form);
      setForm({ label: '', year: '', volume: '', status: 'Held' });
      setShowAdd(false);
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function exportVolumes() {
    exportToExcel(data.volumes, {
      filename: `IGP-${data.abbreviation}-volumes`,
      sheetName: `${data.abbreviation} volumes`,
      columns: [
        { key: 'label', label: 'Volume' },
        { key: 'year', label: 'Year' },
        { key: 'volume', label: 'Vol. no.' },
        { key: 'status', label: 'Status' },
      ],
    });
  }

  if (error && !data) return <div className="alert alert--error">{error}</div>;
  if (!data) return <Spinner center />;
  if (data.kind === 'parts') return <Navigate to="/nwlr" replace />;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub"><Link to="/law-reports">Law reports</Link> · {data.abbreviation}</span>
          <h1>{data.name}</h1>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => window.print()}>Print</button>
          <button className="btn btn--ghost btn--sm" onClick={exportVolumes} disabled={!data.volumes.length}>Export volumes</button>
          <button className="btn btn--sm" onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Cancel' : 'Add volume'}</button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="stat-grid stat-grid--cols" style={{ '--cols': 3 }}>
        <Stat label="Volumes held" value={data.held} />
        <Stat label="Volumes missing" value={data.missing} alert={data.missing > 0} />
        <Stat label="Serial record" value={data.serialAccession || '—'} small />
      </div>

      {showAdd && (
        <div className="panel">
          <h2 className="panel__title">Add a volume</h2>
          <form className="form-grid" onSubmit={onAdd}>
            <div className="field field--full">
              <label>Label<span className="req">*</span></label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. 2014 — LRECN 1" required />
            </div>
            <div className="field"><label>Year</label><input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
            <div className="field"><label>Volume no.</label><input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} /></div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Held">Held</option><option value="Missing">Missing</option>
              </select>
            </div>
            <div className="form-actions field--full"><button className="btn" type="submit" disabled={busy}>Save volume</button></div>
          </form>
        </div>
      )}

      <div className="panel">
        <h2 className="panel__title">Volumes</h2>
        <DataTable
          rows={data.volumes}
          pageSize={10}
          emptyMessage="No volumes recorded yet."
          columns={[
            { key: 'label', label: 'Volume', sortable: true },
            { key: 'year', label: 'Year', sortable: true, render: (v) => v.year || <span className="muted">—</span> },
            { key: 'volume', label: 'Vol. no.', render: (v) => v.volume || <span className="muted">—</span> },
            { key: 'status', label: 'Status', sortable: true,
              render: (v) => <span className={`badge badge--${v.status === 'Held' ? 'held' : 'missing'}`}>{v.status}</span> },
            { key: 'actions', label: '', align: 'right', render: (v) => (
              <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => toggle(v)}>
                Mark {v.status === 'Held' ? 'missing' : 'held'}
              </button>
            ) },
          ]}
        />
      </div>

      <IndexSearch seriesId={data.id} seriesAbbr={data.abbreviation} />
    </>
  );
}

function Stat({ label, value, alert, small }) {
  return (
    <div className={`stat-card${alert ? ' stat-card--alert' : ''}${small ? ' stat-card--mini' : ''}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={small ? { fontSize: '1.6rem' } : undefined}>{value}</div>
    </div>
  );
}
