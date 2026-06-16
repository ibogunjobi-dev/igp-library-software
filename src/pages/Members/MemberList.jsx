// Member (borrower) directory — reusable paginated table (10 per page).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllMembers } from '../../lib/members';
import { norm } from '../../lib/format';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';

export default function MemberList() {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setMembers(await getAllMembers());
      } catch (err) {
        setError(err.message || 'Failed to load members.');
      }
    })();
  }, []);

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!members) return <Spinner center />;

  const term = norm(q);
  const filtered = term
    ? members.filter((m) =>
        [m.fullName, m.memberId, m.email, m.memberType].map(norm).join(' ').includes(term)
      )
    : members;

  const columns = [
    { key: 'memberId', label: 'Member ID', sortable: true,
      render: (m) => <Link to={`/members/${m.id}`}>{m.memberId}</Link> },
    { key: 'fullName', label: 'Full name', sortable: true,
      render: (m) => <Link to={`/members/${m.id}`}>{m.fullName}</Link> },
    { key: 'memberType', label: 'Type', sortable: true },
    { key: 'email', label: 'Email', render: (m) => m.email || <span className="muted">—</span> },
    { key: 'phone', label: 'Phone', render: (m) => m.phone || <span className="muted">—</span> },
    { key: 'status', label: 'Status', sortable: true, render: (m) => <StatusBadge status={m.status} /> },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub">Legal &amp; Knowledge Resources Centre</span>
          <h1>Members</h1>
        </div>
        <div className="page-head__actions">
          <Link to="/members/new" className="btn">Add member</Link>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="field toolbar__search">
            <label>Search members</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, member ID, email…" />
          </div>
        </div>

        {members.length === 0 ? (
          <p className="muted">No members yet. <Link to="/members/new">Add a member</Link>.</p>
        ) : (
          <DataTable columns={columns} rows={filtered} pageSize={10}
            initialSort={{ key: 'memberId', dir: 'asc' }}
            emptyMessage="No members match your search." />
        )}
      </div>
    </>
  );
}
