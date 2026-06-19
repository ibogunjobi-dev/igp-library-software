// Law Reports landing — lists each report series (NWLR, LRECN, and any added).
// NWLR (Part-based) links to its holdings page; volume-based series open their
// own page. New series can be added here.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getLawReportSeriesList, createLawReportSeries } from '../../lib/lawreports';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';

export default function LawReportsList() {
  const [series, setSeries] = useState(null);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ abbreviation: '', name: '', kind: 'volumes' });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function load() {
    try { setSeries(await getLawReportSeriesList()); }
    catch (err) { setError(err.message || 'Failed to load law reports.'); }
  }
  useEffect(() => { load(); }, []);

  function linkFor(s) {
    return s.kind === 'parts' ? '/nwlr' : `/law-reports/${s.id}`;
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!form.abbreviation.trim() || !form.name.trim()) return;
    setBusy(true);
    try {
      const created = await createLawReportSeries(form);
      navigate(created.kind === 'parts' ? '/nwlr' : `/law-reports/${created.id}`);
    } catch (err) {
      setError(err.message || 'Could not add the law report.');
      setBusy(false);
    }
  }

  if (error && !series) return <div className="alert alert--error">{error}</div>;
  if (!series) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub">Legal &amp; Knowledge Resources Centre</span>
          <h1>Law reports</h1>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={() => setShowAdd(true)}>Add law report</button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {showAdd && (
        <Modal
          title="Add a law report series"
          onClose={() => setShowAdd(false)}
          footer={
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn" type="submit" form="add-series-form" disabled={busy}>Create law report</button>
              <button className="btn btn--ghost" onClick={() => setShowAdd(false)} disabled={busy}>Cancel</button>
            </div>
          }
        >
          <form id="add-series-form" className="form-grid form-grid--single" onSubmit={onAdd}>
            <div className="field">
              <label>Abbreviation<span className="req">*</span></label>
              <input value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} placeholder="e.g. FWLR" required />
            </div>
            <div className="field">
              <label>Full name<span className="req">*</span></label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Federation Weekly Law Reports" required />
            </div>
            <div className="field">
              <label>Tracking model</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="volumes">By volume (a list of held volumes)</option>
                <option value="parts">By Part (held / missing, like NWLR)</option>
              </select>
              <span className="field__hint">A catalogue serial record is created automatically.</span>
            </div>
          </form>
        </Modal>
      )}

      <div className="card-grid">
        {series.map((s) => (
          <Link key={s.id} to={linkFor(s)} className="report-card">
            <div className="report-card__abbr">{s.abbreviation}</div>
            <div className="report-card__name">{s.name}</div>
            <div className="report-card__meta">
              <span><strong>{s.held}</strong> of {s.total} {s.kind === 'parts' ? 'Parts' : 'volumes'} held</span>
              <span className="muted">{s.indexCount} index {s.indexCount === 1 ? 'entry' : 'entries'}</span>
            </div>
            {s.serialAccession && <div className="report-card__acc">{s.serialAccession}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
