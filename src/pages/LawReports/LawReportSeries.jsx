// Volume-based law report series (e.g. LRECN) — held volumes + index search.
import { useEffect, useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  getLawReportSeries, addSeriesVolume, setVolumeStatus,
  bulkAddVolumes, deleteLawReportSeries,
} from '../../lib/lawreports';
import { exportToExcel } from '../../lib/excel';
import IndexSearch from '../../components/IndexSearch';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';

export default function LawReportSeries() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', year: '', volume: '', status: 'Held' });
  const [range, setRange] = useState({ parts: '', prefix: 'Part' });
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  async function onAddRange(e) {
    e.preventDefault();
    if (!range.parts.trim()) return;
    setBusy(true);
    try {
      const res = await bulkAddVolumes(id, range.parts, range.prefix || 'Part');
      setRange({ parts: '', prefix: range.prefix || 'Part' });
      setShowAdd(false);
      await load();
      if (res.added === 0) setError('Those parts were already listed — nothing added.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteLawReportSeries(id);
      navigate('/law-reports');
    } catch (err) { setError(err.message); setBusy(false); setConfirmDelete(false); }
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
          <button className="btn btn--sm" onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Cancel' : 'Add parts / volumes'}</button>
          <button className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(true)}>Delete report</button>
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

          <h2 className="panel__title mt-3">Add many parts by range</h2>
          <form className="form-grid" onSubmit={onAddRange}>
            <div className="field field--full">
              <label>Available parts</label>
              <input
                value={range.parts}
                onChange={(e) => setRange({ ...range, parts: e.target.value })}
                placeholder="e.g. 200-500, 502-771, 805"
              />
              <span className="field__hint">Each number is added as a held item; tick / untick them below afterwards.</span>
            </div>
            <div className="field">
              <label>Item label</label>
              <input value={range.prefix} onChange={(e) => setRange({ ...range, prefix: e.target.value })} placeholder="Part" />
              <span className="field__hint">Labelled e.g. “{range.prefix || 'Part'} 200”.</span>
            </div>
            <div className="form-actions field--full"><button className="btn" type="submit" disabled={busy}>Add parts</button></div>
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

      {confirmDelete && (
        <Modal
          title="Delete this law report?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn btn--danger" disabled={busy} onClick={onDelete}>Delete permanently</button>
              <button className="btn btn--ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          }
        >
          <p><strong>{data.name}</strong> ({data.abbreviation})</p>
          <p className="text-small">
            This removes the law report, all {data.volumes.length} of its volumes/parts, its
            index entries, and its catalogue serial record ({data.serialAccession || '—'}).
            This cannot be undone.
          </p>
        </Modal>
      )}
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
