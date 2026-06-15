// Pagination control for table views.
export default function Pagination({ page, pageCount, total, onPage }) {
  if (pageCount <= 1) {
    return <div className="pagination"><span>{total} record{total === 1 ? '' : 's'}</span></div>;
  }
  return (
    <div className="pagination">
      <span>{total} records — page {page} of {pageCount}</span>
      <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button className="btn btn--ghost btn--sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
