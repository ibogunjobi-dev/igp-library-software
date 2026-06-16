// ============================================================================
// Reusable data table used by every list in the app.
//
//  - Paginates at `pageSize` rows (default 10) with Previous / Next controls.
//  - Optional per-column sorting (set `sortable: true`).
//  - Columns: { key, label, render?(row), sortable?, align?, sortValue?(row) }.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Pagination from './Pagination';

export default function DataTable({
  columns,
  rows,
  pageSize = 10,
  initialSort = null, // { key, dir: 'asc' | 'desc' }
  getRowKey = (r, i) => r.id ?? i,
  emptyMessage = 'No records to display.',
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(initialSort);

  // Reset to the first page whenever the result set size changes (e.g. a new
  // search or filter), so the user is never stranded on an empty page.
  useEffect(() => { setPage(1); }, [rows.length]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    const valueOf = (row) =>
      col?.sortValue ? col.sortValue(row) : row[col?.sortKey || sort.key];
    return [...rows].sort((a, b) => {
      const av = valueOf(a) ?? '';
      const bv = valueOf(b) ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'en', { numeric: true }) * dir;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(col) {
    if (!col.sortable) return;
    setSort((s) =>
      s && s.key === col.key
        ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, dir: 'asc' });
  }

  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.sortable ? 'sortable' : ''}${c.align === 'right' ? ' num' : ''}`}
                  onClick={() => toggleSort(c)}
                >
                  {c.label}
                  {sort && sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="muted" style={{ padding: '1rem' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={getRowKey(row, i)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                      {c.render ? c.render(row) : row[c.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageCount={pageCount} total={sorted.length} onPage={setPage} />
    </>
  );
}
