// Issue a loan: choose a member and an available book; set due date from settings.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAllCatalogue } from '../../lib/catalogue';
import { getAllMembers } from '../../lib/members';
import { getSettings } from '../../lib/settings';
import { issueLoan } from '../../lib/loans';
import { useAuth } from '../../context/AuthContext';
import { authorsToDisplay, norm, addDays, toInputDate } from '../../lib/format';
import { NON_LOANABLE_STATUSES } from '../../lib/constants';
import Spinner from '../../components/Spinner';

export default function IssueLoan() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [catalogue, setCatalogue] = useState(null);
  const [members, setMembers] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [bookId, setBookId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [bookSearch, setBookSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, m, s] = await Promise.all([getAllCatalogue(), getAllMembers(), getSettings()]);
        setCatalogue(c);
        setMembers(m);
        setSettings(s);
        setDueDate(toInputDate(addDays(new Date(), s.loanPeriodDays ?? 14)));
        // Pre-select from query params (links from book / member detail).
        const preBook = params.get('book');
        const preMember = params.get('member');
        if (preBook) setBookId(preBook);
        if (preMember) {
          const mm = m.find((x) => x.id === preMember);
          if (mm) setMemberId(mm.id);
        }
      } catch (err) {
        setError(err.message || 'Failed to load data.');
      }
    })();
    // eslint-disable-next-line
  }, []);

  const loanable = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.filter(
      (b) => !NON_LOANABLE_STATUSES.includes(b.status) && (b.copiesAvailable || 0) > 0
    );
  }, [catalogue]);

  const filteredBooks = useMemo(() => {
    const term = norm(bookSearch);
    if (!term) return loanable;
    return loanable.filter((b) =>
      [b.title, authorsToDisplay(b.authors), b.accessionNumber].map(norm).join(' ').includes(term)
    );
  }, [loanable, bookSearch]);

  const activeMembers = useMemo(
    () => (members || []).filter((m) => m.status === 'Active'),
    [members]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const book = catalogue.find((b) => b.id === bookId);
    const member = members.find((m) => m.id === memberId);
    if (!book) { setError('Select a book to loan.'); return; }
    if (!member) { setError('Select a member.'); return; }

    setSaving(true);
    try {
      await issueLoan({
        book, member, settings, dueDate,
        issuedBy: user?.email || 'admin', notes,
      });
      navigate(`/members/${member.id}`);
    } catch (err) {
      setError(err.message || 'Failed to issue loan.');
      setSaving(false);
    }
  }

  if (error && !catalogue) return <div className="alert alert--error">{error}</div>;
  if (!catalogue || !members || !settings) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>Issue loan</h1>
        <div className="page-head__actions">
          <Link to="/loans" className="btn btn--ghost">Cancel</Link>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {activeMembers.length === 0 && (
        <div className="alert alert--info">
          There are no active members. <Link to="/members/new">Add a member</Link> first.
        </div>
      )}
      {loanable.length === 0 && (
        <div className="alert alert--info">No items are currently available to loan.</div>
      )}

      <form className="panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Member<span className="req">*</span></label>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Select a member…</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} — {m.memberId}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <span className="field__hint">Default: {settings.loanPeriodDays} days from today.</span>
          </div>

          <div className="field field--full">
            <label>Find a book</label>
            <input value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
              placeholder="Filter the loanable list by title, author or accession…" />
          </div>

          <div className="field field--full">
            <label>Book<span className="req">*</span></label>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} size={8} style={{ height: 'auto' }}>
              {filteredBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.accessionNumber} — {b.title}
                  {b.edition ? ` (${b.edition})` : ''} · {b.copiesAvailable} available
                </option>
              ))}
            </select>
          </div>

          <div className="field field--full">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving || !bookId || !memberId}>
            {saving ? 'Issuing…' : 'Issue loan'}
          </button>
          <Link to="/loans" className="btn btn--ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
