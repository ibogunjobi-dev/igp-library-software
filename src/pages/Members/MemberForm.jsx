// Add / edit a member. The Librarian maintains these; members never self-register.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMember, createMember, updateMember } from '../../lib/members';
import { MEMBER_TYPES, MEMBER_STATUSES } from '../../lib/constants';
import { toInputDate } from '../../lib/format';
import Spinner from '../../components/Spinner';

const EMPTY = {
  fullName: '', memberType: 'Associate', email: '', phone: '',
  dateAdded: toInputDate(new Date()), status: 'Active', notes: '',
};

export default function MemberForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const m = await getMember(id);
        if (!m) { setServerError('Member not found.'); return; }
        setForm({ ...EMPTY, ...m, dateAdded: toInputDate(m.dateAdded) });
      } catch (err) {
        setServerError(err.message || 'Failed to load member.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function validate() {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required.';
    if (!MEMBER_TYPES.includes(form.memberType)) e.memberType = 'Select a member type.';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      e.email = 'Enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateMember(id, {
          fullName: form.fullName.trim(),
          memberType: form.memberType,
          email: form.email.trim(),
          phone: form.phone.trim(),
          dateAdded: form.dateAdded,
          status: form.status,
          notes: form.notes.trim(),
        });
        navigate(`/members/${id}`);
      } else {
        const created = await createMember(form);
        navigate(`/members/${created.id}`);
      }
    } catch (err) {
      setServerError(err.message || 'Failed to save member.');
      setSaving(false);
    }
  }

  if (loading) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>{isEdit ? 'Edit member' : 'Add member'}</h1>
      </div>
      {serverError && <div className="alert alert--error">{serverError}</div>}

      <form className="panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field field--full">
            <label>Full name<span className="req">*</span></label>
            <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
            {errors.fullName && <span className="field__error">{errors.fullName}</span>}
          </div>

          <div className="field">
            <label>Member type<span className="req">*</span></label>
            <select value={form.memberType} onChange={(e) => set('memberType', e.target.value)}>
              {MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.memberType && <span className="field__error">{errors.memberType}</span>}
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>

          <div className="field">
            <label>Date added</label>
            <input type="date" value={form.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} />
          </div>

          <div className="field field--full">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Free-text notes on the member's activity." />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save member'}
          </button>
          <Link to={isEdit ? `/members/${id}` : '/members'} className="btn btn--ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
