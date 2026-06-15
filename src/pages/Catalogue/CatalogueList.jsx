// Catalogue list view — paginated, sortable table.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCatalogue } from '../../lib/catalogue';
import { authorsToDisplay } from '../../lib/format';
import { exportToExcel } from '../../lib/excel';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';

const PAGE_SIZE = 20;

const COLUMNS = [
  { key: 'accessionNumber', label: 'Accession' },
  { key: 'title', label: 'Title' },
  { key: 'authorsDisplay', label: 'Author' },
  { key: 'edition', label: 'Edition' },
  { key: 'grouping', label: 'Grouping' },
  { key: 'collection', label: 'Collection' },
  { key: 'copies', label: 'Copies', sort: 'copiesAvailable' },
  { key: 'status', label: 'Status' },
];

export default function CatalogueList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('accessionNumber');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAllCatalogue();
        setItems(data.map((r) => ({ ...r, authorsDisplay: authorsToDisplay(r.authors) })));
      } catch (err) {
        setError(err.message || 'Failed to load catalogue.');
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    if (!items) return [];
    const col = COLUMNS.find((c) => c.key === sortKey);
    const field = col?.sort || sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = a[field] ?? '';
      const bv = b[field] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'en', { numeric: true }) * dir;
    });
  }, [items, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  // Export the full catalogue (all rows, current sort order) to .xlsx.
  function exportCatalogue() {
    exportToExcel(sorted, {
      filename: 'IGP-catalogue',
      sheetName: 'Catalogue',
      columns: [
        { key: 'accessionNumber', label: 'Accession No.' },
        { key: 'title', label: 'Title' },
        { key: 'authorsDisplay', label: 'Author(s)' },
        { key: 'edition', label: 'Edition' },
        { key: 'publisher', label: 'Publisher' },
        { key: 'year', label: 'Year' },
        { key: 'grouping', label: 'Grouping' },
        { key: 'collection', label: 'Collection' },
        { key: 'copiesTotal', label: 'Copies (total)' },
        { key: 'copiesAvailable', label: 'Copies (available)' },
        { key: 'status', label: 'Status' },
        { key: 'firmAuthorship', label: 'Firm authorship' },
        { key: 'shelfLocation', label: 'Shelf location' },
        { key: 'acquisitionDate', label: 'Date acquired' },
        { key: 'notes', label: 'Notes' },
      ],
    });
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!items) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>Catalogue</h1>
        <div className="page-head__actions">
          <button className="btn btn--ghost" onClick={exportCatalogue} disabled={!items.length}>
            Export to Excel
          </button>
          <Link to="/search" className="btn btn--ghost">Search &amp; filter</Link>
          <Link to="/catalogue/new" className="btn">Add record</Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel">
          <p className="muted">
            The catalogue is empty. <Link to="/catalogue/new">Add a record</Link> or{' '}
            <Link to="/import">import existing holdings</Link>.
          </p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="sortable"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      {sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/catalogue/${r.id}`}>{r.accessionNumber}</Link></td>
                    <td>
                      <Link to={`/catalogue/${r.id}`}>{r.title}</Link>
                      {r.firmAuthorship && <span className="badge badge--firm" style={{ marginLeft: 6 }}>Firm</span>}
                    </td>
                    <td>{r.authorsDisplay || <span className="muted">—</span>}</td>
                    <td>{r.edition || <span className="muted">—</span>}</td>
                    <td>{r.grouping}</td>
                    <td>{r.collection}</td>
                    <td className="num">{r.copiesAvailable ?? 0} / {r.copiesTotal ?? 0}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} total={sorted.length} onPage={setPage} />
        </div>
      )}
    </>
  );
}
