// Free-text search and faceted filtering across the catalogue.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCatalogue } from '../lib/catalogue';
import { authorsToDisplay, norm } from '../lib/format';
import { GROUPINGS, COLLECTIONS, CATALOGUE_STATUSES } from '../lib/constants';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';

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

        <DataTable
          rows={results}
          pageSize={10}
          initialSort={{ key: 'accessionNumber', dir: 'asc' }}
          emptyMessage="No records match the current filters."
          columns={[
            { key: 'accessionNumber', label: 'Accession', sortable: true,
              render: (r) => <Link to={`/catalogue/${r.id}`}>{r.accessionNumber}</Link> },
            { key: 'title', label: 'Title', sortable: true, render: (r) => (
              <>
                <Link to={`/catalogue/${r.id}`}>{r.title}</Link>
                {r.firmAuthorship && <span className="badge badge--firm" style={{ marginLeft: 6 }}>Firm</span>}
              </>
            ) },
            { key: 'author', label: 'Author', sortValue: (r) => authorsToDisplay(r.authors),
              render: (r) => authorsToDisplay(r.authors) || <span className="muted">—</span> },
            { key: 'edition', label: 'Edition', render: (r) => r.edition || <span className="muted">—</span> },
            { key: 'grouping', label: 'Grouping', sortable: true },
            { key: 'collection', label: 'Collection', sortable: true },
            { key: 'copies', label: 'Copies', align: 'right', sortable: true,
              sortValue: (r) => r.copiesAvailable ?? 0,
              render: (r) => `${r.copiesAvailable ?? 0} / ${r.copiesTotal ?? 0}` },
            { key: 'status', label: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </div>
    </>
  );
}
