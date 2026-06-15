// Member (borrower) directory.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllMembers } from '../../lib/members';
import { norm } from '../../lib/format';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';

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

  return (
    <>
      <div className="page-head">
        <h1>Members</h1>
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
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Member ID</th><th>Full name</th><th>Type</th>
                  <th>Email</th><th>Phone</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td><Link to={`/members/${m.id}`}>{m.memberId}</Link></td>
                    <td><Link to={`/members/${m.id}`}>{m.fullName}</Link></td>
                    <td>{m.memberType}</td>
                    <td>{m.email || <span className="muted">—</span>}</td>
                    <td>{m.phone || <span className="muted">—</span>}</td>
                    <td><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="muted">No members match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
