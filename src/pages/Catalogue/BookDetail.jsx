// View an individual catalogue record, with status actions and a loan link.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCatalogueItem, setCatalogueStatus } from '../../lib/catalogue';
import { authorsToDisplay, formatDate, docRef } from '../../lib/format';
import { NON_LOANABLE_STATUSES } from '../../lib/constants';
import Spinner from '../../components/Spinner';
import StatusBadge, { FirmAuthorshipBadge } from '../../components/StatusBadge';

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
        </div>
      </div>
    </>
  );
}
