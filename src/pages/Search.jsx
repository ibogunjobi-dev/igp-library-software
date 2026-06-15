// Free-text search and faceted filtering across the catalogue.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCatalogue } from '../lib/catalogue';
import { authorsToDisplay, norm } from '../lib/format';
import { GROUPINGS, COLLECTIONS, CATALOGUE_STATUSES } from '../lib/constants';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';

export default function SearchPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [grouping, setGrouping] = useState('');
  const [collection, setCollection] = useState('');
  const [status, setStatus] = useState('');
  const [firmOnly, setFirmOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setItems(await getAllCatalogue());
      } catch (err) {
        setError(err.message || 'Failed to load catalogue.');
      }
    })();
  }, []);

  const results = useMemo(() => {
    if (!items) return [];
    const term = norm(q);
    return items.filter((r) => {
      if (grouping && r.grouping !== grouping) return false;
      if (collection && r.collection !== collection) return false;
      if (status && r.status !== status) return false;
      if (firmOnly && !r.firmAuthorship) return false;
      if (availableOnly && (r.copiesAvailable || 0) <= 0) return false;
      if (!term) return true;
      const haystack = [
        r.title,
        authorsToDisplay(r.authors),
        r.publisher,
        r.accessionNumber,
        Array.isArray(r.keywords) ? r.keywords.join(' ') : r.keywords,
      ].map(norm).join(' ');
      return haystack.includes(term);
    });
  }, [items, q, grouping, collection, status, firmOnly, availableOnly]);

  function reset() {
    setQ(''); setGrouping(''); setCollection(''); setStatus('');
    setFirmOnly(false); setAvailableOnly(false);
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!items) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>Search &amp; filter</h1>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="field toolbar__search">
            <label>Free-text search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, author, publisher, keyword, accession…"
            />
          </div>
          <div className="field">
            <label>Grouping</label>
            <select value={grouping} onChange={(e) => setGrouping(e.target.value)}>
              <option value="">All</option>
              {GROUPINGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Collection</label>
            <select value={collection} onChange={(e) => setCollection(e.target.value)}>
              <option value="">All</option>
              {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {CATALOGUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <label className="row text-small" style={{ cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={firmOnly} onChange={(e) => setFirmOnly(e.target.checked)} />
              Firm authorship
            </label>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <label className="row text-small" style={{ cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
              Available only
            </label>
          </div>
          <button className="btn btn--ghost" onClick={reset}>Reset</button>
        </div>

        <p className="text-small muted">{results.length} matching record{results.length === 1 ? '' : 's'}.</p>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Accession</th><th>Title</th><th>Author</th><th>Edition</th>
                <th>Grouping</th><th>Collection</th><th>Copies</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/catalogue/${r.id}`}>{r.accessionNumber}</Link></td>
                  <td>
                    <Link to={`/catalogue/${r.id}`}>{r.title}</Link>
                    {r.firmAuthorship && <span className="badge badge--firm" style={{ marginLeft: 6 }}>Firm</span>}
                  </td>
                  <td>{authorsToDisplay(r.authors) || <span className="muted">—</span>}</td>
                  <td>{r.edition || <span className="muted">—</span>}</td>
                  <td>{r.grouping}</td>
                  <td>{r.collection}</td>
                  <td className="num">{r.copiesAvailable ?? 0} / {r.copiesTotal ?? 0}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={8} className="muted">No records match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
