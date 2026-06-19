// View an individual catalogue record, with status actions and a loan link.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCatalogueItem, setCatalogueStatus, deleteCatalogueItem, getAllCatalogue, mergeCatalogue } from '../../lib/catalogue';
import { authorsToDisplay, formatDate, docRef, norm } from '../../lib/format';
import { NON_LOANABLE_STATUSES } from '../../lib/constants';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import StatusBadge, { FirmAuthorshipBadge } from '../../components/StatusBadge';

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState({});

  async function load() {
    try {
      const data = await getCatalogueItem(id);
      if (!data) setError('Record not found.');
      else setItem(data);
    } catch (err) {
      setError(err.message || 'Failed to load record.');
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function changeStatus(status) {
    setBusy(true);
    try {
      await setCatalogueStatus(id, status);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function withdrawFromModal() {
    setConfirmDelete(false);
    await changeStatus('Withdrawn');
  }

  async function deletePermanently() {
    setBusy(true);
    try {
      await deleteCatalogueItem(id);
      navigate('/catalogue');
    } catch (err) {
      setError(err.message || 'Failed to delete record.');
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  // Open the merge picker: candidates share this record's title and have a
  // compatible edition and year (matching, or unspecified on either side).
  async function openMerge() {
    setBusy(true);
    try {
      const all = await getAllCatalogue();
      const compat = (a, b) => !a || !b || norm(a) === norm(b);
      const found = all.filter(
        (r) => r.id !== item.id &&
          norm(r.title) === norm(item.title) &&
          compat(r.edition, item.edition) &&
          compat(String(r.year), String(item.year))
      );
      setCandidates(found);
      setSelected({});
      setMergeOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to find duplicates.');
    } finally {
      setBusy(false);
    }
  }

  async function doMerge() {
    const ids = Object.keys(selected).filter((k) => selected[k]).map(Number);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await mergeCatalogue(item.id, ids);
      setMergeOpen(false);
      await load();
    } catch (err) {
      setError(err.message || 'Merge failed.');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!item) return <Spinner center />;

  const canLoan =
    !NON_LOANABLE_STATUSES.includes(item.status) && (item.copiesAvailable || 0) > 0;

  return (
    <>
      <div className="page-head">
        <h1>{item.title}</h1>
        <div className="page-head__actions">
          <Link to="/catalogue" className="btn btn--ghost">Back</Link>
          <Link to={`/catalogue/${id}/edit`} className="btn btn--dark">Edit</Link>
          {canLoan && (
            <Link to={`/loans/new?book=${id}`} className="btn">Issue loan</Link>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="row mb-2">
          <StatusBadge status={item.status} />
          {item.firmAuthorship && <FirmAuthorshipBadge />}
          <span className="muted text-small">Ref: {docRef(item.accessionNumber)}</span>
        </div>

        <dl className="dl">
          <dt>Accession number</dt><dd>{item.accessionNumber}</dd>
          <dt>Author(s)</dt><dd>{authorsToDisplay(item.authors) || '—'}</dd>
          <dt>Publisher</dt><dd>{item.publisher || '—'}</dd>
          <dt>Edition</dt><dd>{item.edition || '—'}</dd>
          <dt>Year</dt><dd>{item.year || '—'}</dd>
          <dt>ISBN</dt><dd>{item.isbn || '—'}</dd>
          <dt>ISSN</dt><dd>{item.issn || '—'}</dd>
          {(item.volume || item.part) && (<><dt>Volume / Part</dt><dd>{item.volume || '—'} / {item.part || '—'}</dd></>)}
          <dt>Grouping</dt><dd>{item.grouping}</dd>
          <dt>Collection</dt><dd>{item.collection}</dd>
          <dt>Copies</dt><dd>{item.copiesAvailable ?? 0} available of {item.copiesTotal ?? 0}</dd>
          <dt>Shelf location</dt><dd>{item.shelfLocation || '—'}</dd>
          <dt>Acquisition date</dt><dd>{item.acquisitionDate ? formatDate(item.acquisitionDate) : '—'}</dd>
          <dt>Keywords</dt>
          <dd>
            {Array.isArray(item.keywords) && item.keywords.length ? (
              <span className="tag-row">{item.keywords.map((k) => <span key={k} className="tag">{k}</span>)}</span>
            ) : '—'}
          </dd>
          <dt>Notes</dt><dd>{item.notes || '—'}</dd>
        </dl>
      </div>

      <div className="panel">
        <h2 className="panel__title">Record management</h2>
        <p className="text-small muted">
          Withdrawing or marking an item missing changes its status but retains the
          record in the catalogue — items are never hard-deleted.
        </p>
        <div className="row mt-1">
          {item.status !== 'Missing' && (
            <button className="btn btn--ghost" disabled={busy} onClick={() => changeStatus('Missing')}>
              Mark missing
            </button>
          )}
          {item.status !== 'Withdrawn' && (
            <button className="btn btn--ghost" disabled={busy} onClick={() => changeStatus('Withdrawn')}>
              Withdraw
            </button>
          )}
          {(item.status === 'Missing' || item.status === 'Withdrawn') && (
            <button className="btn btn--dark" disabled={busy} onClick={() => changeStatus('Available')}>
              Restore to Available
            </button>
          )}
          {item.status !== 'Reference only' && (
            <button className="btn btn--ghost" disabled={busy} onClick={() => changeStatus('Reference only')}>
              Set reference only
            </button>
          )}
          <button className="btn btn--ghost" disabled={busy} onClick={openMerge}>
            Merge duplicates
          </button>
          <button className="btn btn--danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            Delete record
          </button>
        </div>
      </div>

      {mergeOpen && (
        <Modal
          title="Merge duplicate records"
          onClose={() => setMergeOpen(false)}
          footer={
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn" disabled={busy || !Object.values(selected).some(Boolean)} onClick={doMerge}>
                Merge selected into this record
              </button>
              <button className="btn btn--ghost" disabled={busy} onClick={() => setMergeOpen(false)}>Cancel</button>
            </div>
          }
        >
          <p className="text-small">
            Keeping <strong>{item.accessionNumber}</strong> — {item.title}. Selected records'
            copy counts are added here and those records are removed. Loan history is preserved.
          </p>
          {candidates.length === 0 ? (
            <p className="muted">No other records share this title with a compatible edition/year.</p>
          ) : (
            <div className="tag-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              {candidates.map((c) => (
                <label key={c.id} className="filter-dropdown__item" style={{ border: '1px solid var(--igp-line)', padding: '0.5rem 0.6rem' }}>
                  <input
                    type="checkbox"
                    checked={!!selected[c.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.checked }))}
                  />
                  <span>
                    <strong>{c.accessionNumber}</strong> — {c.title}
                    <span className="text-small muted">
                      {' '}· {c.edition || 'no edition'} · {c.year || 'no year'} · {c.copiesAvailable}/{c.copiesTotal} copies
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Delete this record?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn btn--danger" disabled={busy} onClick={deletePermanently}>
                Delete permanently
              </button>
              <button className="btn" disabled={busy} onClick={withdrawFromModal}>
                Withdraw instead (keep record)
              </button>
              <button className="btn btn--ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          }
        >
          <p>
            <strong>{item.title}</strong> ({item.accessionNumber})
          </p>
          <p className="text-small">
            <strong>Delete permanently</strong> removes the record from the catalogue
            entirely and cannot be undone. <strong>Withdraw</strong> keeps the record
            for the archive but marks it as no longer in circulation.
          </p>
          <p className="text-small muted">
            Records with copies currently out on loan cannot be deleted — return the
            loans first, or withdraw instead.
          </p>
        </Modal>
      )}
    </>
  );
}
