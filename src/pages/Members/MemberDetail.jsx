// Member detail — profile, current loans, full loan history, count held.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMember, updateMember } from '../../lib/members';
import { getLoansForMember, returnLoan, renewLoan } from '../../lib/loans';
import { getSettings } from '../../lib/settings';
import { formatDate } from '../../lib/format';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [loans, setLoans] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const m = await getMember(id);
      if (!m) { setError('Member not found.'); return; }
      setMember(m);
      const [l, s] = await Promise.all([getLoansForMember(m.memberId), getSettings()]);
      setLoans(l);
      setSettings(s);
    } catch (err) {
      setError(err.message || 'Failed to load member.');
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function toggleStatus() {
    setBusy(true);
    try {
      await updateMember(id, { status: member.status === 'Active' ? 'Inactive' : 'Active' });
      await load();
    } finally { setBusy(false); }
  }

  async function doReturn(loan) {
    setBusy(true);
    try { await returnLoan(loan); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function doRenew(loan) {
    setBusy(true);
    try { await renewLoan(loan, settings); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!member || !loans) return <Spinner center />;

  const current = loans.filter((l) => !l.dateReturned);
  const history = loans;

  return (
    <>
      <div className="page-head">
        <h1>{member.fullName}</h1>
        <div className="page-head__actions">
          <Link to="/members" className="btn btn--ghost">Back</Link>
          <Link to={`/members/${id}/edit`} className="btn btn--dark">Edit</Link>
          <button className="btn btn--ghost" disabled={busy} onClick={toggleStatus}>
            Set {member.status === 'Active' ? 'inactive' : 'active'}
          </button>
          <Link to={`/loans/new?member=${id}`} className="btn">Issue loan</Link>
        </div>
      </div>

      <div className="panel">
        <div className="row mb-2">
          <StatusBadge status={member.status} />
          <span className="badge badge--firm">{current.length} book{current.length === 1 ? '' : 's'} currently held</span>
        </div>
        <dl className="dl">
          <dt>Member ID</dt><dd>{member.memberId}</dd>
          <dt>Type</dt><dd>{member.memberType}</dd>
          <dt>Email</dt><dd>{member.email || '—'}</dd>
          <dt>Phone</dt><dd>{member.phone || '—'}</dd>
          <dt>Date added</dt><dd>{formatDate(member.dateAdded)}</dd>
          <dt>Notes</dt><dd>{member.notes || '—'}</dd>
        </dl>
      </div>

      <div className="panel">
        <h2 className="panel__title">Current loans ({current.length})</h2>
        {current.length === 0 ? (
          <p className="muted">No items currently on loan.</p>
        ) : (
          <LoanTable loans={current} actions onReturn={doReturn} onRenew={doRenew} busy={busy} canRenew={settings?.allowRenewals} />
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Loan history ({history.length})</h2>
        {history.length === 0 ? (
          <p className="muted">No loan history.</p>
        ) : (
          <LoanTable loans={history} />
        )}
      </div>
    </>
  );
}

function LoanTable({ loans, actions, onReturn, onRenew, busy, canRenew }) {
  const columns = [
    { key: 'loanId', label: 'Loan', sortable: true },
    { key: 'bookTitle', label: 'Title', sortable: true },
    { key: 'dateIssued', label: 'Issued', sortable: true, render: (l) => formatDate(l.dateIssued) },
    { key: 'dueDate', label: 'Due', sortable: true, render: (l) => formatDate(l.dueDate) },
    { key: 'dateReturned', label: 'Returned', render: (l) => (l.dateReturned ? formatDate(l.dateReturned) : '—') },
    { key: 'renewedCount', label: 'Renewals', align: 'right', render: (l) => l.renewedCount || 0 },
    { key: 'status', label: 'Status', sortable: true, render: (l) => <StatusBadge status={l.status} /> },
  ];
  if (actions) {
    columns.push({ key: 'actions', label: 'Actions', render: (l) => (
      <div className="row">
        <button className="btn btn--sm" disabled={busy} onClick={() => onReturn(l)}>Return</button>
        {canRenew && (
          <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => onRenew(l)}>Renew</button>
        )}
      </div>
    ) });
  }
  return <DataTable columns={columns} rows={loans} pageSize={10}
    initialSort={{ key: 'dateIssued', dir: 'desc' }} />;
}
