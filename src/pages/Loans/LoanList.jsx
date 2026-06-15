// Loans register — filter by status, member, and date range; return / renew.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAllLoans, returnLoan, renewLoan } from '../../lib/loans';
import { getSettings } from '../../lib/settings';
import { formatDate, norm, toDate } from '../../lib/format';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';

export default function LoanList() {
  const [params] = useSearchParams();
  const [loans, setLoans] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [statusFilter, setStatusFilter] = useState(params.get('filter') || 'all');
  const [memberQ, setMemberQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load() {
    try {
      const [l, s] = await Promise.all([getAllLoans(), getSettings()]);
      setLoans(l);
      setSettings(s);
    } catch (err) {
      setError(err.message || 'Failed to load loans.');
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!loans) return [];
    const term = norm(memberQ);
    const fromD = from ? toDate(from) : null;
    const toD = to ? toDate(to) : null;
    return loans.filter((l) => {
      if (statusFilter === 'current' && l.dateReturned) return false;
      if (statusFilter === 'overdue' && l.status !== 'Overdue') return false;
      if (statusFilter === 'returned' && !l.dateReturned) return false;
      if (term && !norm(l.memberName).includes(term) && !norm(l.memberId).includes(term)) return false;
      const issued = toDate(l.dateIssued);
      if (fromD && issued && issued < fromD) return false;
      if (toD && issued && issued > toD) return false;
      return true;
    });
  }, [loans, statusFilter, memberQ, from, to]);

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
  if (!loans) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>Loans</h1>
        <div className="page-head__actions">
          <Link to="/loans/new" className="btn">Issue loan</Link>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="field">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="current">On loan (outstanding)</option>
              <option value="overdue">Overdue</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <div className="field">
            <label>Member</label>
            <input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Name or member ID" />
          </div>
          <div className="field">
            <label>Issued from</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Issued to</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <p className="text-small muted">{filtered.length} loan{filtered.length === 1 ? '' : 's'}.</p>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Loan</th><th>Title</th><th>Member</th><th>Issued</th>
                <th>Due</th><th>Returned</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>{l.loanId}</td>
                  <td>{l.bookTitle}</td>
                  <td>{l.memberName}</td>
                  <td>{formatDate(l.dateIssued)}</td>
                  <td>{formatDate(l.dueDate)}</td>
                  <td>{l.dateReturned ? formatDate(l.dateReturned) : '—'}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td>
                    {!l.dateReturned && (
                      <div className="row">
                        <button className="btn btn--sm" disabled={busy} onClick={() => doReturn(l)}>Return</button>
                        {settings?.allowRenewals && (
                          <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => doRenew(l)}>Renew</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="muted">No loans match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
