// Add / edit a catalogue record. Includes same-edition duplicate detection.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  getAllCatalogue,
  getCatalogueItem,
  createCatalogueItem,
  updateCatalogueItem,
  incrementCopies,
  findDuplicate,
  getAuthors,
} from '../../lib/catalogue';
import {
  GROUPINGS,
  COLLECTIONS,
  CATALOGUE_STATUSES,
  DEFAULT_COLLECTION,
} from '../../lib/constants';
import { authorsToDisplay, toInputDate } from '../../lib/format';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';

const EMPTY = {
  title: '', authors: '', publisher: '', edition: '', year: '',
  isbn: '', issn: '', grouping: GROUPINGS[0], collection: DEFAULT_COLLECTION,
  copiesTotal: 1, status: 'Available', firmAuthorship: false,
  keywords: '', shelfLocation: '', acquisitionDate: '', volume: '', part: '', notes: '',
};

export default function BookForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [authorOptions, setAuthorOptions] = useState([]);

  // Load existing author names for the picker (select existing or type a new one).
  useEffect(() => {
    getAuthors().then((list) => setAuthorOptions(list.map((a) => a.name))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const item = await getCatalogueItem(id);
        if (!item) { setServerError('Record not found.'); return; }
        setForm({
          ...EMPTY,
          ...item,
          authors: authorsToDisplay(item.authors),
          keywords: Array.isArray(item.keywords) ? item.keywords.join(', ') : item.keywords || '',
          acquisitionDate: toInputDate(item.acquisitionDate),
        });
      } catch (err) {
        setServerError(err.message || 'Failed to load record.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    // Authors may be empty for serials (e.g. law reports), so not mandatory.
    if (!form.grouping) e.grouping = 'Grouping is required.';
    if (!GROUPINGS.includes(form.grouping)) e.grouping = 'Choose one of the five firm groupings.';
    const copies = parseInt(form.copiesTotal, 10);
    if (!Number.isFinite(copies) || copies < 1) e.copiesTotal = 'Must be at least 1.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    if (isEdit) {
      await save();
      return;
    }

    // New record — run duplicate detection first.
    setSaving(true);
    try {
      const all = await getAllCatalogue();
      const match = findDuplicate(all, form);
      if (match) {
        setDuplicate(match);
        setSaving(false);
        return; // wait for the Librarian's decision in the modal
      }
      await save();
    } catch (err) {
      setServerError(err.message || 'Failed to save.');
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (isEdit) {
        await updateCatalogueItem(id, {
          title: form.title.trim(),
          authors: form.authors,
          publisher: form.publisher,
          edition: form.edition,
          year: form.year,
          isbn: form.isbn,
          issn: form.issn,
          grouping: form.grouping,
          collection: form.collection,
          copiesTotal: form.copiesTotal,
          status: form.status,
          firmAuthorship: form.firmAuthorship,
          keywords: form.keywords,
          shelfLocation: form.shelfLocation,
          acquisitionDate: form.acquisitionDate || null,
          volume: form.volume,
          part: form.part,
          notes: form.notes,
        });
        navigate(`/catalogue/${id}`);
      } else {
        const created = await createCatalogueItem(form);
        navigate(`/catalogue/${created.id}`);
      }
    } catch (err) {
      setServerError(err.message || 'Failed to save.');
      setSaving(false);
    }
  }

  async function rollUpDuplicate() {
    setSaving(true);
    try {
      const add = Math.max(1, parseInt(form.copiesTotal, 10) || 1);
      await incrementCopies(duplicate.id, add);
      navigate(`/catalogue/${duplicate.id}`);
    } catch (err) {
      setServerError(err.message || 'Failed to update copies.');
      setSaving(false);
      setDuplicate(null);
    }
  }

  if (loading) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>{isEdit ? 'Edit catalogue record' : 'Add catalogue record'}</h1>
        <div className="page-head__actions">
          <Link to={isEdit ? `/catalogue/${id}` : '/catalogue'} className="btn btn--ghost">Cancel</Link>
        </div>
      </div>

      {serverError && <div className="alert alert--error">{serverError}</div>}

      <form className="panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <Field label="Title" required error={errors.title} full>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>

          <Field label="Author(s)" hint="Pick an existing author or type a new one. Separate multiple authors with a semicolon.">
            <input
              value={form.authors}
              onChange={(e) => set('authors', e.target.value)}
              list="author-options"
              autoComplete="off"
            />
            <datalist id="author-options">
              {authorOptions.map((a) => <option key={a} value={a} />)}
            </datalist>
          </Field>
          <Field label="Publisher">
            <input value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
          </Field>

          <Field label="Edition" hint="Different editions are separate records.">
            <input value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. 3rd edn" />
          </Field>
          <Field label="Year">
            <input value={form.year} onChange={(e) => set('year', e.target.value)} />
          </Field>

          <Field label="ISBN">
            <input value={form.isbn} onChange={(e) => set('isbn', e.target.value)} />
          </Field>
          <Field label="ISSN">
            <input value={form.issn} onChange={(e) => set('issn', e.target.value)} />
          </Field>

          <Field label="Grouping" required error={errors.grouping}>
            <select value={form.grouping} onChange={(e) => set('grouping', e.target.value)}>
              {GROUPINGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Collection">
            <select value={form.collection} onChange={(e) => set('collection', e.target.value)}>
              {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Total copies" required error={errors.copiesTotal}
            hint="Multiple copies of the same edition = one record with a copy count.">
            <input type="number" min="1" value={form.copiesTotal}
              onChange={(e) => set('copiesTotal', e.target.value)} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {CATALOGUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Volume" hint="Serials / law reports (e.g. NWLR).">
            <input value={form.volume} onChange={(e) => set('volume', e.target.value)} />
          </Field>
          <Field label="Part" hint="Serials / law reports (e.g. NWLR Part).">
            <input value={form.part} onChange={(e) => set('part', e.target.value)} />
          </Field>

          <Field label="Shelf location">
            <input value={form.shelfLocation} onChange={(e) => set('shelfLocation', e.target.value)} />
          </Field>
          <Field label="Acquisition date">
            <input type="date" value={form.acquisitionDate} onChange={(e) => set('acquisitionDate', e.target.value)} />
          </Field>

          <Field label="Keywords" hint="Comma-separated retrieval tags." full>
            <input value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
          </Field>

          <Field label="Notes" full>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <div className="field field--full">
            <label className="row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.firmAuthorship}
                onChange={(e) => set('firmAuthorship', e.target.checked)}
                style={{ width: 'auto' }}
              />
              <span>Firm authorship — work authored by the Founder/Chairman</span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save record'}
          </button>
          <Link to={isEdit ? `/catalogue/${id}` : '/catalogue'} className="btn btn--ghost">Cancel</Link>
        </div>
      </form>

      {duplicate && (
        <Modal
          title="Possible duplicate found"
          onClose={() => setDuplicate(null)}
          footer={
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn" onClick={rollUpDuplicate} disabled={saving}>
                Add copies to existing record
              </button>
              <button className="btn btn--ghost" onClick={save} disabled={saving}>
                Create as separate record
              </button>
              <button className="btn btn--ghost" onClick={() => setDuplicate(null)}>Cancel</button>
            </div>
          }
        >
          <p>
            A record with the same title, author, edition and publisher already exists:
          </p>
          <div className="panel" style={{ boxShadow: 'none' }}>
            <strong>{duplicate.title}</strong>
            <div className="text-small muted">
              {authorsToDisplay(duplicate.authors)}{duplicate.edition ? ` — ${duplicate.edition}` : ''}
              {duplicate.publisher ? ` — ${duplicate.publisher}` : ''}
            </div>
            <div className="text-small mt-1">
              {duplicate.accessionNumber} · {duplicate.copiesAvailable}/{duplicate.copiesTotal} copies available
            </div>
          </div>
          <p className="text-small muted mt-1">
            Recommended: roll the new copies up into the existing record rather than
            create a duplicate. Only create a separate record if this is genuinely a
            different edition.
          </p>
        </Modal>
      )}
    </>
  );
}

function Field({ label, required, error, hint, full, children }) {
  return (
    <div className={`field${full ? ' field--full' : ''}`}>
      <label>{label}{required && <span className="req">*</span>}</label>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
