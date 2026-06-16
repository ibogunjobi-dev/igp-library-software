// Catalogue list view — reusable paginated, sortable table (10 per page).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCatalogue } from '../../lib/catalogue';
import { authorsToDisplay } from '../../lib/format';
import { exportToExcel } from '../../lib/excel';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';

export default function CatalogueList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

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

  function exportCatalogue() {
    exportToExcel(items, {
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

  const columns = [
    { key: 'accessionNumber', label: 'Accession', sortable: true,
      render: (r) => <Link to={`/catalogue/${r.id}`}>{r.accessionNumber}</Link> },
    { key: 'title', label: 'Title', sortable: true,
      render: (r) => (
        <>
          <Link to={`/catalogue/${r.id}`}>{r.title}</Link>
          {r.firmAuthorship && <span className="badge badge--firm" style={{ marginLeft: 6 }}>Firm</span>}
        </>
      ) },
    { key: 'authorsDisplay', label: 'Author', sortable: true,
      render: (r) => r.authorsDisplay || <span className="muted">—</span> },
    { key: 'edition', label: 'Edition', render: (r) => r.edition || <span className="muted">—</span> },
    { key: 'grouping', label: 'Grouping', sortable: true },
    { key: 'collection', label: 'Collection', sortable: true },
    { key: 'copies', label: 'Copies', align: 'right', sortable: true,
      sortValue: (r) => r.copiesAvailable ?? 0,
      render: (r) => `${r.copiesAvailable ?? 0} / ${r.copiesTotal ?? 0}` },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub">Legal &amp; Knowledge Resources Centre</span>
          <h1>Catalogue</h1>
        </div>
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
          <DataTable columns={columns} rows={items} pageSize={10}
            initialSort={{ key: 'accessionNumber', dir: 'asc' }} />
        </div>
      )}
    </>
  );
}
