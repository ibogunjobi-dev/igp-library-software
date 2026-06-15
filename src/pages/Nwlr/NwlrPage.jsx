// NWLR Holdings Status — held vs missing, bands, flagged gaps, per-Part lookup.
// NWLR is the Part-based law report series; this page sits under "Law reports".
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNwlrStatus, getNwlrParts, lookupNwlrPart, markNwlrPartHeld, setNwlrUpperBound } from '../../lib/nwlr';
import { getLawReportSeriesList } from '../../lib/lawreports';
import { exportToExcel } from '../../lib/excel';
import IndexSearch from '../../components/IndexSearch';
import Spinner from '../../components/Spinner';

export default function NwlrPage() {
  const [status, setStatus] = useState(null);
  const [seriesId, setSeriesId] = useState(null); // for index search
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Per-Part lookup state.
  const [partInput, setPartInput] = useState('');
  const [lookup, setLookup] = useState(null);

  // Upper-bound editor.
  const [boundInput, setBoundInput] = useState('');

  async function load() {
    try {
      const s = await getNwlrStatus();
      setStatus(s);
      setBoundInput(String(s.upperBound));
    } catch (err) {
      setError(err.message || 'Failed to load NWLR status.');
    }
  }
  useEffect(() => { load(); }, []);
  // Resolve the NWLR series id so its indexes can be searched / added.
  useEffect(() => {
    getLawReportSeriesList()
      .then((list) => { const n = list.find((s) => s.abbreviation === 'NWLR'); if (n) setSeriesId(n.id); })
      .catch(() => {});
  }, []);

  async function doLookup(e) {
    e.preventDefault();
    setLookup(null);
    const n = parseInt(partInput, 10);
    if (!Number.isFinite(n) || n < 1) { setLookup({ error: 'Enter a valid Part number.' }); return; }
    try {
      setLookup(await lookupNwlrPart(n));
    } catch (err) {
      setLookup({ error: err.message });
    }
  }

  async function flipHeld(n) {
    setBusy(true);
    try { await markNwlrPartHeld(n); await load(); if (lookup?.part === n) setLookup({ part: n, status: 'Held' }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveBound(e) {
    e.preventDefault();
    const n = parseInt(boundInput, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setBusy(true);
    try { await setNwlrUpperBound(n, true); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function exportBands() {
    exportToExcel(
      status.bands.map((b) => ({ band: b.label, held: b.held, missing: b.missing, total: b.total })),
      { filename: 'IGP-NWLR-holdings', sheetName: 'NWLR holdings',
        columns: [
          { key: 'band', label: 'Band' }, { key: 'held', label: 'Held' },
          { key: 'missing', label: 'Missing' }, { key: 'total', label: 'Total' },
        ] }
    );
  }

  // Export the Missing Parts list, or the Available (Held) Parts list, to Excel.
  async function exportParts(which) {
    setBusy(true);
    try {
      const { parts } = await getNwlrParts(which); // 'Missing' | 'Held'
      const label = which === 'Held' ? 'available' : 'missing';
      exportToExcel(
        parts.map((p) => ({ part: p.part, title: 'Nigerian Weekly Law Reports (NWLR)', status: p.status })),
        { filename: `IGP-NWLR-${label}-parts`, sheetName: `NWLR ${label}`,
          columns: [
            { key: 'part', label: 'NWLR Part' },
            { key: 'title', label: 'Serial' },
            { key: 'status', label: 'Status' },
          ] }
      );
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !status) return <div className="alert alert--error">{error}</div>;
  if (!status) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub"><Link to="/law-reports">Law reports</Link> · NWLR</span>
          <h1>NWLR holdings status</h1>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => window.print()}>Print</button>
          <button className="btn btn--ghost btn--sm" onClick={exportBands}>Export bands</button>
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => exportParts('Missing')}>
            Export missing Parts
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => exportParts('Held')}>
            Export available Parts
          </button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="print-only">
        <h2>Izy Global Partners LLP — NWLR holdings status</h2>
      </div>

      <div className="stat-grid">
        <Stat label="Parts held" value={status.held} />
        <Stat label="Parts missing" value={status.missing} alert />
        <Stat label="Run to Part" value={status.upperBound} />
        <Stat label="Serial record" value={status.serialAccession || '—'} small />
      </div>
      {status.upperProvisional && (
        <div className="alert alert--info mt-2">
          The upper bound (Part {status.upperBound}) is <strong>provisional</strong> until the
          most recent Part actually held is confirmed. Update it below once known.
        </div>
      )}

      <div className="panel">
        <h2 className="panel__title">Held vs missing by band</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Band</th><th>Held</th><th>Missing</th><th>Total</th></tr></thead>
            <tbody>
              {status.bands.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td className="num">{b.held}</td>
                  <td className="num">{b.missing}</td>
                  <td className="num">{b.total}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td><td className="num">{status.held}</td>
                <td className="num">{status.missing}</td><td className="num">{status.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Large contiguous gaps — flagged for shelf re-check</h2>
        <div className="tag-row">
          {status.flaggedGaps.map((g) => (
            <span key={`${g.from}-${g.to}`} className="badge badge--missing" style={{ fontSize: '0.85rem' }}>
              Parts {g.from}–{g.to}
            </span>
          ))}
        </div>
        <p className="text-small muted mt-2">
          These ranges are entirely (or almost entirely) not held — worth a physical
          shelf check before treating them as genuinely missing.
        </p>
      </div>

      <div className="panel">
        <h2 className="panel__title">Per-Part lookup</h2>
        <form className="toolbar" onSubmit={doLookup} style={{ marginBottom: 0 }}>
          <div className="field">
            <label>Part number</label>
            <input value={partInput} onChange={(e) => setPartInput(e.target.value)} placeholder="e.g. 165" />
          </div>
          <button className="btn" type="submit">Look up</button>
        </form>
        {lookup && (
          <div className="mt-2">
            {lookup.error ? (
              <span className="field__error">{lookup.error}</span>
            ) : (
              <div className="row">
                <span>Part <strong>{lookup.part}</strong>:</span>
                <span className={`badge badge--${lookup.status === 'Held' ? 'held' : lookup.status === 'Missing' ? 'missing' : 'withdrawn'}`}>
                  {lookup.status}
                </span>
                {lookup.status === 'Missing' && (
                  <button className="btn btn--sm" disabled={busy} onClick={() => flipHeld(lookup.part)}>
                    Mark as held (acquired)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Run upper bound</h2>
        <form className="toolbar" onSubmit={saveBound} style={{ marginBottom: 0 }}>
          <div className="field">
            <label>Most recent Part held</label>
            <input value={boundInput} onChange={(e) => setBoundInput(e.target.value)} />
            <span className="field__hint">Raising this adds the new Parts as Held by default.</span>
          </div>
          <button className="btn" type="submit" disabled={busy}>Update bound</button>
        </form>
      </div>

      {seriesId && <IndexSearch seriesId={seriesId} seriesAbbr="NWLR" />}
    </>
  );
}

function Stat({ label, value, alert, small }) {
  return (
    <div className={`stat-card${alert ? ' stat-card--alert' : ''}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={small ? { fontSize: '1.1rem', wordBreak: 'break-all' } : undefined}>{value}</div>
    </div>
  );
}
