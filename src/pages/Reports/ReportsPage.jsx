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
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Collection</th><th>Grouping</th><th>Titles</th><th>Copies</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}><td>{r.collection}</td><td>{r.grouping}</td>
                <td className="num">{r.titles}</td><td className="num">{r.copies}</td></tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={2}>Total</td>
              <td className="num">{catalogue.length}</td>
              <td className="num">{catalogue.reduce((s, r) => s + (r.copiesTotal || 0), 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Acquired</th><th>Accession</th><th>Title</th><th>Author</th><th>Grouping</th><th>Copies</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.acquisitionDate)}</td>
                  <td>{r.accessionNumber}</td>
                  <td>{r.title}</td>
                  <td>{authorsToDisplay(r.authors) || '—'}</td>
                  <td>{r.grouping}</td>
                  <td className="num">{r.copiesTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Member ID</th><th>Name</th><th>Type</th><th>Status</th><th>Total loans</th><th>Held</th><th>Overdue</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId}>
                <td>{r.memberId}</td><td>{r.fullName}</td><td>{r.memberType}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="num">{r.totalLoans}</td>
                <td className="num">{r.currentlyHeld}</td>
                <td className="num">{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Band</th><th>Held</th><th>Missing</th><th>Total</th></tr></thead>
          <tbody>
            {status.bands.map((b) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td className="num">{b.held}</td>
                <td className="num">{b.missing}</td>
                <td className="num">{b.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th>Loan</th><th>Title</th><th>Member</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th></tr></thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id}>
              <td>{l.loanId}</td><td>{l.bookTitle}</td><td>{l.memberName}</td>
              <td>{formatDate(l.dateIssued)}</td><td>{formatDate(l.dueDate)}</td>
              <td>{l.dateReturned ? formatDate(l.dateReturned) : '—'}</td>
              <td><StatusBadge status={l.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
