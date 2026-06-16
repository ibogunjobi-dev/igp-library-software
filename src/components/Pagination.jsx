// Pagination control for table views: Previous / Next plus numbered page
// buttons to jump directly to any page (with ellipses when there are many).
export default function Pagination({ page, pageCount, total, onPage }) {
  if (pageCount <= 1) {
    return <div className="pagination"><span>{total} record{total === 1 ? '' : 's'}</span></div>;
  }

  return (
    <div className="pagination">
      <span className="pagination__count">{total} records — page {page} of {pageCount}</span>
      <div className="pagination__pages">
        <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        {pageItems(page, pageCount).map((it, i) =>
          it === '…' ? (
            <span key={`gap-${i}`} className="pagination__ellipsis">…</span>
          ) : (
            <button
              key={it}
              className={`btn btn--sm pagination__num${it === page ? '' : ' btn--ghost'}`}
              aria-current={it === page ? 'page' : undefined}
              onClick={() => onPage(it)}
            >
              {it}
            </button>
          )
        )}
        <button className="btn btn--ghost btn--sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

// Build the windowed list of page numbers, e.g. [1, '…', 4, 5, 6, '…', 13].
function pageItems(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items = new Set([1, 2, pageCount - 1, pageCount, page - 1, page, page + 1]);
  const sorted = [...items].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}
