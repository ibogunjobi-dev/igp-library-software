// ============================================================================
// Reports. Each report is exportable to Excel (SheetJS) and printable.
//
// Default report set (per spec; the FC's eventual read-only selection is to be
// confirmed in Phase 2 — see ROADMAP.md):
//   1. Catalogue overview by grouping and collection
//   2. Current (outstanding) loans
//   3. Overdue loans
//   4. Loan history (filterable by member / book / date range)
//   5. Acquisitions log (by acquisition date)
//   6. Member directory with borrowing activity
//   7. NWLR holdings status (Parts held vs missing)
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCatalogue } from '../../lib/catalogue';
import { getNwlrStatus } from '../../lib/nwlr';
import { getAllMembers } from '../../lib/members';
import { getAllLoans, isOverdue } from '../../lib/loans';
import { exportToExcel } from '../../lib/excel';
import { GROUPINGS, COLLECTIONS, FIRM_NAME } from '../../lib/constants';
import { authorsToDisplay, formatDate, norm, toDate } from '../../lib/format';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';

const REPORTS = [
  { id: 'overview', label: 'Catalogue overview' },
  { id: 'current', label: 'Current loans' },
  { id: 'overdue', label: 'Overdue loans' },
  { id: 'history', label: 'Loan history' },
  { id: 'acquisitions', label: 'Acquisitions log' },
  { id: 'members', label: 'Member directory' },
  { id: 'nwlr', label: 'NWLR holdings status' },
];

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState('overview');

  useEffect(() => {
    (async () => {
      try {
        const [catalogue, members, loans] = await Promise.all([
          getAllCatalogue(), getAllMembers(), getAllLoans(),
        ]);
        setData({ catalogue, members, loans });
      } catch (err) {
        setError(err.message || 'Failed to load report data.');
      }
    })();
  }, []);

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!data) return <Spinner center />;

  return (
    <>
      <div className="page-head">
        <h1>Reports</h1>
      </div>

      <div className="panel">
        <div className="row">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              className={`btn btn--sm ${active === r.id ? '' : 'btn--ghost'}`}
              onClick={() => setActive(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="print-only">
        <h2>{FIRM_NAME} — Legal &amp; Knowledge Resources Centre</h2>
        <p>{REPORTS.find((r) => r.id === active)?.label} — generated {formatDate(new Date())}</p>
      </div>

      {active === 'overview' && <OverviewReport {...data} />}
      {active === 'current' && <CurrentLoansReport {...data} />}
      {active === 'overdue' && <OverdueReport {...data} />}
      {active === 'history' && <HistoryReport {...data} />}
      {active === 'acquisitions' && <AcquisitionsReport {...data} />}
      {active === 'members' && <MemberDirectoryReport {...data} />}
      {active === 'nwlr' && <NwlrReport {...data} />}
    </>
  );
}

// Shared header with export + print buttons.
function ReportShell({ title, onExport, children }) {
  return (
    <div className="panel">
      <div className="spread">
        <h2 className="panel__title" style={{ margin: 0 }}>{title}</h2>
        <div className="row">
          <button className="btn btn--ghost btn--sm" onClick={() => window.print()}>Print</button>
          <button className="btn btn--sm" onClick={onExport}>Export to Excel</button>
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// --- 1. Catalogue overview --------------------------------------------------
function OverviewReport({ catalogue }) {
  const rows = useMemo(() => {
    const out = [];
    for (const collection of COLLECTIONS) {
      for (const grouping of GROUPINGS) {
        const items = catalogue.filter((r) => r.collection === collection && r.grouping === grouping);
        out.push({
          collection,
          grouping,
          titles: items.length,
          copies: items.reduce((s, r) => s + (r.copiesTotal || 0), 0),
        });
      }
    }
    return out;
  }, [catalogue]);

  const exp = () =>
    exportToExcel(rows, {
      filename: 'IGP-catalogue-overview',
      sheetName: 'Overview',
      columns: [
        { key: 'collection', label: 'Collection' },
        { key: 'grouping', label: 'Grouping' },
        { key: 'titles', label: 'Titles' },
        { key: 'copies', label: 'Copies' },
      ],
    });

  return (
    <ReportShell title="Catalogue overview by grouping and collection" onExport={exp}>
      <DataTable
        rows={rows}
        pageSize={10}
        getRowKey={(r) => `${r.collection}-${r.grouping}`}
        columns={[
          { key: 'collection', label: 'Collection' },
          { key: 'grouping', label: 'Grouping' },
          { key: 'titles', label: 'Titles', align: 'right' },
          { key: 'copies', label: 'Copies', align: 'right' },
        ]}
      />
      <p className="text-small muted mt-2">
        Total — {catalogue.length} titles, {catalogue.reduce((s, r) => s + (r.copiesTotal || 0), 0)} copies.
      </p>
    </ReportShell>
  );
}

// --- 2. Current loans -------------------------------------------------------
function CurrentLoansReport({ loans }) {
  const rows = loans.filter((l) => !l.dateReturned);
  const exp = () => exportToExcel(rows.map(loanRow), { filename: 'IGP-current-loans', sheetName: 'Current loans', columns: LOAN_COLS });
  return (
    <ReportShell title="Current (outstanding) loans" onExport={exp}>
      <LoanTable loans={rows} empty="No outstanding loans." />
    </ReportShell>
  );
}

// --- 3. Overdue loans -------------------------------------------------------
function OverdueReport({ loans }) {
  const rows = loans.filter(isOverdue);
  const exp = () => exportToExcel(rows.map(loanRow), { filename: 'IGP-overdue-loans', sheetName: 'Overdue loans', columns: LOAN_COLS });
  return (
    <ReportShell title="Overdue loans" onExport={exp}>
      <LoanTable loans={rows} empty="No overdue loans." />
    </ReportShell>
  );
}

// --- 4. Loan history --------------------------------------------------------
function HistoryReport({ loans }) {
  const [memberQ, setMemberQ] = useState('');
  const [bookQ, setBookQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rows = useMemo(() => {
    const m = norm(memberQ), b = norm(bookQ);
    const fromD = from ? toDate(from) : null, toD = to ? toDate(to) : null;
    return loans.filter((l) => {
      if (m && !norm(l.memberName).includes(m) && !norm(l.memberId).includes(m)) return false;
      if (b && !norm(l.bookTitle).includes(b) && !norm(l.accessionNumber).includes(b)) return false;
      const issued = toDate(l.dateIssued);
      if (fromD && issued && issued < fromD) return false;
      if (toD && issued && issued > toD) return false;
      return true;
    });
  }, [loans, memberQ, bookQ, from, to]);

  const exp = () => exportToExcel(rows.map(loanRow), { filename: 'IGP-loan-history', sheetName: 'Loan history', columns: LOAN_COLS });

  return (
    <ReportShell title="Loan history" onExport={exp}>
      <div className="toolbar">
        <div className="field"><label>Member</label><input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Name or ID" /></div>
        <div className="field"><label>Book</label><input value={bookQ} onChange={(e) => setBookQ(e.target.value)} placeholder="Title or accession" /></div>
        <div className="field"><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <LoanTable loans={rows} empty="No loans match the filters." />
    </ReportShell>
  );
}

// --- 5. Acquisitions log ----------------------------------------------------
function AcquisitionsReport({ catalogue }) {
  const rows = useMemo(
    () =>
      [...catalogue]
        .filter((r) => r.acquisitionDate)
        .sort((a, b) => String(b.acquisitionDate).localeCompare(String(a.acquisitionDate))),
    [catalogue]
  );
  const exp = () =>
    exportToExcel(
      rows.map((r) => ({
        acquisitionDate: formatDate(r.acquisitionDate),
        accessionNumber: r.accessionNumber,
        title: r.title,
        authors: authorsToDisplay(r.authors),
        grouping: r.grouping,
        collection: r.collection,
        copiesTotal: r.copiesTotal,
      })),
      {
        filename: 'IGP-acquisitions-log',
        sheetName: 'Acquisitions',
        columns: [
          { key: 'acquisitionDate', label: 'Acquisition date' },
          { key: 'accessionNumber', label: 'Accession' },
          { key: 'title', label: 'Title' },
          { key: 'authors', label: 'Author(s)' },
          { key: 'grouping', label: 'Grouping' },
          { key: 'collection', label: 'Collection' },
          { key: 'copiesTotal', label: 'Copies' },
        ],
      }
    );
  return (
    <ReportShell title="Acquisitions log (by acquisition date)" onExport={exp}>
      {rows.length === 0 ? (
        <p className="muted">No records carry an acquisition date.</p>
      ) : (
        <DataTable
          rows={rows}
          pageSize={10}
          columns={[
            { key: 'acquisitionDate', label: 'Acquired', sortable: true, render: (r) => formatDate(r.acquisitionDate) },
            { key: 'accessionNumber', label: 'Accession', sortable: true },
            { key: 'title', label: 'Title', sortable: true },
            { key: 'author', label: 'Author', sortValue: (r) => authorsToDisplay(r.authors), render: (r) => authorsToDisplay(r.authors) || '—' },
            { key: 'grouping', label: 'Grouping', sortable: true },
            { key: 'copiesTotal', label: 'Copies', align: 'right' },
          ]}
        />
      )}
    </ReportShell>
  );
}

// --- 6. Member directory with borrowing activity ---------------------------
function MemberDirectoryReport({ members, loans }) {
  const rows = useMemo(
    () =>
      members.map((m) => {
        const mine = loans.filter((l) => l.memberId === m.memberId);
        const current = mine.filter((l) => !l.dateReturned);
        return {
          memberId: m.memberId,
          fullName: m.fullName,
          memberType: m.memberType,
          status: m.status,
          totalLoans: mine.length,
          currentlyHeld: current.length,
          overdue: current.filter(isOverdue).length,
        };
      }),
    [members, loans]
  );
  const exp = () =>
    exportToExcel(rows, {
      filename: 'IGP-member-directory',
      sheetName: 'Members',
      columns: [
        { key: 'memberId', label: 'Member ID' },
        { key: 'fullName', label: 'Full name' },
        { key: 'memberType', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'totalLoans', label: 'Total loans' },
        { key: 'currentlyHeld', label: 'Currently held' },
        { key: 'overdue', label: 'Overdue' },
      ],
    });
  return (
    <ReportShell title="Member directory with borrowing activity" onExport={exp}>
      <DataTable
        rows={rows}
        pageSize={10}
        getRowKey={(r) => r.memberId}
        initialSort={{ key: 'memberId', dir: 'asc' }}
        columns={[
          { key: 'memberId', label: 'Member ID', sortable: true },
          { key: 'fullName', label: 'Name', sortable: true },
          { key: 'memberType', label: 'Type', sortable: true },
          { key: 'status', label: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
          { key: 'totalLoans', label: 'Total loans', align: 'right', sortable: true },
          { key: 'currentlyHeld', label: 'Held', align: 'right', sortable: true },
          { key: 'overdue', label: 'Overdue', align: 'right', sortable: true },
        ]}
      />
    </ReportShell>
  );
}

// --- 7. NWLR holdings status (Parts held vs missing) -----------------------
// Reads the NWLR Parts dataset (one entry per Part, Held/Missing). The
// interactive view (per-Part lookup, flip-to-held) lives at /nwlr.
function NwlrReport() {
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try { setStatus(await getNwlrStatus()); }
      catch (e) { setErr(e.message || 'Failed to load NWLR status.'); }
    })();
  }, []);

  const exp = () =>
    exportToExcel(
      status.bands.map((b) => ({ band: b.label, held: b.held, missing: b.missing, total: b.total })),
      { filename: 'IGP-NWLR-holdings', sheetName: 'NWLR holdings',
        columns: [
          { key: 'band', label: 'Band' }, { key: 'held', label: 'Held' },
          { key: 'missing', label: 'Missing' }, { key: 'total', label: 'Total' },
        ] }
    );

  if (err) return <div className="alert alert--error">{err}</div>;
  if (!status) return <Spinner center />;

  return (
    <ReportShell title="NWLR holdings status — Parts held vs missing" onExport={exp}>
      <p className="text-small muted">
        NWLR is one serial catalogue record ({status.serialAccession}); its Parts
        are tracked Held / Missing. Run to Part {status.upperBound}
        {status.upperProvisional ? ' (provisional)' : ''}. The interactive view
        (per-Part lookup and marking Parts as acquired) is under{' '}
        <Link to="/nwlr">NWLR holdings</Link>.
      </p>
      <div className="row mb-2">
        <span className="badge badge--held">Held {status.held}</span>
        <span className="badge badge--missing">Missing {status.missing}</span>
        <span className="badge badge--reference">Total {status.total}</span>
      </div>
      <DataTable
        rows={status.bands}
        pageSize={10}
        getRowKey={(b) => b.label}
        columns={[
          { key: 'label', label: 'Band' },
          { key: 'held', label: 'Held', align: 'right' },
          { key: 'missing', label: 'Missing', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ]}
      />
      <p className="text-small muted mt-2">
        Large contiguous gaps flagged for shelf re-check:{' '}
        {status.flaggedGaps.map((g) => `${g.from}–${g.to}`).join(', ')}.
      </p>
    </ReportShell>
  );
}

// --- Shared loan rendering --------------------------------------------------
const LOAN_COLS = [
  { key: 'loanId', label: 'Loan ID' },
  { key: 'accessionNumber', label: 'Accession' },
  { key: 'bookTitle', label: 'Title' },
  { key: 'memberId', label: 'Member ID' },
  { key: 'memberName', label: 'Member' },
  { key: 'dateIssued', label: 'Issued' },
  { key: 'dueDate', label: 'Due' },
  { key: 'dateReturned', label: 'Returned' },
  { key: 'status', label: 'Status' },
  { key: 'renewedCount', label: 'Renewals' },
];

function loanRow(l) {
  return {
    loanId: l.loanId,
    accessionNumber: l.accessionNumber,
    bookTitle: l.bookTitle,
    memberId: l.memberId,
    memberName: l.memberName,
    dateIssued: formatDate(l.dateIssued),
    dueDate: formatDate(l.dueDate),
    dateReturned: l.dateReturned ? formatDate(l.dateReturned) : '',
    status: l.status,
    renewedCount: l.renewedCount || 0,
  };
}

function LoanTable({ loans, empty }) {
  if (loans.length === 0) return <p className="muted">{empty}</p>;
  return (
    <DataTable
      rows={loans}
      pageSize={10}
      initialSort={{ key: 'dateIssued', dir: 'desc' }}
      columns={[
        { key: 'loanId', label: 'Loan', sortable: true },
        { key: 'bookTitle', label: 'Title', sortable: true },
        { key: 'memberName', label: 'Member', sortable: true },
        { key: 'dateIssued', label: 'Issued', sortable: true, render: (l) => formatDate(l.dateIssued) },
        { key: 'dueDate', label: 'Due', sortable: true, render: (l) => formatDate(l.dueDate) },
        { key: 'dateReturned', label: 'Returned', render: (l) => (l.dateReturned ? formatDate(l.dateReturned) : '—') },
        { key: 'status', label: 'Status', sortable: true, render: (l) => <StatusBadge status={l.status} /> },
      ]}
    />
  );
}
