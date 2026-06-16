// Dashboard home — headline figures and recent activity.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCatalogue } from '../lib/catalogue';
import { getAllLoans, isOverdue } from '../lib/loans';
import { GROUPINGS, COLLECTIONS, FIRM_NAME } from '../lib/constants';
import { formatDate, toDate } from '../lib/format';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';

export default function Dashboard() {
  const [catalogue, setCatalogue] = useState(null);
  const [loans, setLoans] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, l] = await Promise.all([getAllCatalogue(), getAllLoans()]);
        setCatalogue(c);
        setLoans(l);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data.');
      }
    })();
  }, []);

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!catalogue || !loans) return <Spinner center />;

  const totalTitles = catalogue.length;
  const totalCopies = catalogue.reduce((s, r) => s + (r.copiesTotal || 0), 0);
  const current = loans.filter((l) => !l.dateReturned);
  const overdue = current.filter(isOverdue);

  const byGrouping = GROUPINGS.map((g) => ({
    label: g,
    count: catalogue.filter((r) => r.grouping === g).length,
  }));
  const byCollection = COLLECTIONS.map((c) => ({
    label: c,
    count: catalogue.filter((r) => r.collection === c).length,
  }));

  const recent = [...catalogue]
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
    .slice(0, 8);

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="muted text-small">{FIRM_NAME} — Legal &amp; Knowledge Resources Centre</span>
      </div>

      <div className="stat-grid">
        <Stat label="Total titles" value={totalTitles} />
        <Stat label="Total copies" value={totalCopies} />
        <Stat label="Current loans" value={current.length} />
        <Stat label="Overdue loans" value={overdue.length} alert={overdue.length > 0} />
      </div>

      <div className="panel mt-3">
        <h2 className="panel__title">Holdings by grouping</h2>
        <div className="stat-grid stat-grid--cols" style={{ '--cols': byGrouping.length }}>
          {byGrouping.map((g) => (
            <Stat key={g.label} label={g.label} value={g.count} small />
          ))}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Holdings by collection</h2>
        <div className="stat-grid stat-grid--cols" style={{ '--cols': byCollection.length }}>
          {byCollection.map((c) => (
            <Stat key={c.label} label={c.label} value={c.count} small />
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="spread">
          <h2 className="panel__title" style={{ margin: 0 }}>Recently added</h2>
          <Link to="/catalogue" className="btn btn--ghost btn--sm">View catalogue</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted mt-1">No catalogue records yet. Add a record or import existing holdings.</p>
        ) : (
          <div className="mt-1">
            <DataTable
              rows={recent}
              pageSize={10}
              columns={[
                { key: 'accessionNumber', label: 'Accession', render: (r) => <Link to={`/catalogue/${r.id}`}>{r.accessionNumber}</Link> },
                { key: 'title', label: 'Title' },
                { key: 'grouping', label: 'Grouping' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'createdAt', label: 'Added', render: (r) => formatDate(r.createdAt) },
              ]}
            />
          </div>
        )}
      </div>

      {overdue.length > 0 && (
        <div className="panel">
          <div className="spread">
            <h2 className="panel__title" style={{ margin: 0 }}>Overdue — action required</h2>
            <Link to="/loans?filter=overdue" className="btn btn--ghost btn--sm">View all loans</Link>
          </div>
          <div className="mt-1">
            <DataTable
              rows={overdue}
              pageSize={10}
              columns={[
                { key: 'loanId', label: 'Loan' },
                { key: 'bookTitle', label: 'Title' },
                { key: 'memberName', label: 'Member' },
                { key: 'dueDate', label: 'Due', render: (l) => formatDate(l.dueDate) },
              ]}
            />
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, alert, small }) {
  // `small` cards (holdings by grouping / collection) centre their text and
  // stretch their background to fill the row.
  return (
    <div className={`stat-card${alert ? ' stat-card--alert' : ''}${small ? ' stat-card--mini' : ''}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={small ? { fontSize: '1.9rem' } : undefined}>{value}</div>
    </div>
  );
}
