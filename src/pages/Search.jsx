// Free-text search and faceted filtering across the catalogue.
// Matching is relevance-ranked (closest matches first) and supports partial /
// out-of-order matches. A scope lets the Librarian search all fields, just the
// title, or just the author.
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
  const [scope, setScope] = useState('all'); // all | title | author
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
    // Apply facet filters first.
    const faceted = items.filter((r) => {
      if (grouping && r.grouping !== grouping) return false;
      if (collection && r.collection !== collection) return false;
      if (status && r.status !== status) return false;
      if (firmOnly && !r.firmAuthorship) return false;
      if (availableOnly && (r.copiesAvailable || 0) <= 0) return false;
      return true;
    });
    if (!term) {
      return [...faceted].sort((a, b) => String(a.accessionNumber).localeCompare(String(b.accessionNumber)));
    }
    // Score, keep matches, rank most-similar first.
    return faceted
      .map((r) => ({ r, score: relevance(r, term, scope) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || String(a.r.title).localeCompare(String(b.r.title)))
      .map((x) => x.r);
  }, [items, q, scope, grouping, collection, status, firmOnly, availableOnly]);

  function reset() {
    setQ(''); setScope('all'); setGrouping(''); setCollection(''); setStatus('');
    setFirmOnly(false); setAvailableOnly(false);
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!items) return <Spinner center />;

  const activeFilters = (firmOnly ? 1 : 0) + (availableOnly ? 1 : 0);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub">Legal &amp; Knowledge Resources Centre</span>
          <h1>Search &amp; filter</h1>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="field toolbar__search">
            <label>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, author, publisher, keyword, accession…"
            />
          </div>
          <div className="field">
            <label>Look in</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">All fields</option>
              <option value="title">Book title</option>
              <option value="author">Author</option>
            </select>
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

          {/* Extra filters tucked into a dropdown to save space. */}
          <details className="filter-dropdown">
            <summary className="btn btn--ghost btn--sm">
              Filters{activeFilters ? ` (${activeFilters})` : ''}
            </summary>
            <div className="filter-dropdown__menu">
              <label className="filter-dropdown__item">
                <input type="checkbox" checked={firmOnly} onChange={(e) => setFirmOnly(e.target.checked)} />
                Firm authorship
              </label>
              <label className="filter-dropdown__item">
                <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
                Available only
              </label>
            </div>
          </details>

          <button className="btn btn--ghost btn--sm" onClick={reset}>Reset</button>
        </div>

        <p className="text-small muted">
          {results.length} matching record{results.length === 1 ? '' : 's'}
          {q ? ' — most relevant first' : ''}.
        </p>

        <DataTable
          rows={results}
          pageSize={10}
          emptyMessage="No records match the current search."
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

// --- Relevance scoring ------------------------------------------------------
// Higher = more similar. 0 = no match (excluded). Considers exact match,
// prefix, word-prefix, substring (earlier = better), and subsequence (the
// query letters appearing in order), plus a token-overlap bonus.
function relevance(record, term, scope) {
  const title = norm(record.title);
  const author = norm(authorsToDisplay(record.authors));
  const fields =
    scope === 'title' ? [{ t: title, w: 1 }]
      : scope === 'author' ? [{ t: author, w: 1 }]
        : [
            { t: title, w: 1 },
            { t: author, w: 0.95 },
            { t: norm(record.publisher), w: 0.7 },
            { t: norm(Array.isArray(record.keywords) ? record.keywords.join(' ') : record.keywords), w: 0.7 },
            { t: norm(record.accessionNumber), w: 0.8 },
          ];
  let best = 0;
  for (const f of fields) best = Math.max(best, scoreText(f.t, term) * f.w);
  return best;
}

function scoreText(hay, q) {
  if (!hay) return 0;
  if (hay === q) return 100;
  if (hay.startsWith(q)) return 85;
  const idx = hay.indexOf(q);
  if (idx >= 0) return 70 - Math.min(idx, 40) * 0.5; // earlier substring ranks higher
  const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((t) => t.startsWith(q))) return 55;
  // All query words present somewhere (order-independent).
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length > 1 && qWords.every((w) => hay.includes(w))) return 45;
  if (isSubsequence(q.replace(/\s+/g, ''), hay)) return 18;
  return 0;
}

// True if all characters of q appear in hay in order (loose fuzzy match).
function isSubsequence(q, hay) {
  if (!q) return false;
  let i = 0;
  for (let j = 0; j < hay.length && i < q.length; j += 1) {
    if (hay[j] === q[i]) i += 1;
  }
  return i === q.length;
}
