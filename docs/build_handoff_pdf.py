#!/usr/bin/env python3
# ============================================================================
# Builds the comprehensive project-memory / handoff PDF for the
# Izy Global Partners LLP — Library Management System.
# Output: docs/IGP-Library-Project-Memory.pdf
# ============================================================================
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, ListFlowable, ListItem, HRFlowable, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

# --- Brand palette ----------------------------------------------------------
BLACK = colors.HexColor("#0a0a0b")
GOLD = colors.HexColor("#ceaa51")
GOLD_DEEP = colors.HexColor("#8c6f24")
CREAM = colors.HexColor("#f6f2e9")
INK = colors.HexColor("#1c1a14")
INK_SOFT = colors.HexColor("#57503f")
CODE_BG = colors.HexColor("#141416")
CODE_FG = colors.HexColor("#e7ca7e")

OUT = "docs/IGP-Library-Project-Memory.pdf"

styles = getSampleStyleSheet()


def S(name, **kw):
    styles.add(ParagraphStyle(name, parent=styles["Normal"], **kw))


S("Body", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, spaceAfter=6)
S("Body2", fontName="Helvetica", fontSize=9, leading=13, textColor=INK_SOFT, spaceAfter=4)
S("H1x", fontName="Times-Bold", fontSize=19, leading=23, textColor=BLACK, spaceBefore=10, spaceAfter=8)
S("H2x", fontName="Times-Bold", fontSize=13.5, leading=17, textColor=GOLD_DEEP, spaceBefore=12, spaceAfter=5)
S("H3x", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=INK, spaceBefore=8, spaceAfter=3)
S("CodeBlk", fontName="Courier", fontSize=8, leading=11, textColor=CODE_FG, backColor=CODE_BG,
  borderPadding=(6, 6, 6, 6), spaceBefore=4, spaceAfter=8, leftIndent=2)
S("Cell", fontName="Helvetica", fontSize=8.2, leading=11, textColor=INK)
S("CellH", fontName="Helvetica-Bold", fontSize=8.2, leading=11, textColor=CREAM)
S("Cover", fontName="Times-Bold", fontSize=30, leading=34, textColor=GOLD, alignment=TA_CENTER)
S("CoverSub", fontName="Helvetica", fontSize=11, leading=16, textColor=CREAM, alignment=TA_CENTER)
S("TOCEntry", fontName="Helvetica", fontSize=10, leading=18, textColor=INK)

H1, H2, H3 = styles["H1x"], styles["H2x"], styles["H3x"]
BODY, BODY2, CODE = styles["Body"], styles["Body2"], styles["CodeBlk"]


# --- Heading flowables that register with the TOC ---------------------------
class H(Paragraph):
    def __init__(self, text, level, style):
        super().__init__(text, style)
        self._toc_level = level
        self._toc_text = text


class DocTemplate(BaseDocTemplate):
    """Registers heading flowables with the table of contents + PDF outline."""
    def afterFlowable(self, flowable):
        if isinstance(flowable, H):
            lvl, text = flowable._toc_level, flowable._toc_text
            key = f"h{lvl}-{abs(hash(text)) % (10**8)}-{self.page}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, lvl, 0)
            self.notify("TOCEntry", (lvl, text, self.page, key))


def h1(t):
    return H(t, 0, H1)


def h2(t):
    return H(t, 1, H2)


def code(t):
    # escape for Paragraph
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = t.replace("\n", "<br/>").replace(" ", "&nbsp;")
    return Paragraph(t, CODE)


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, BODY), leftIndent=10, value="•") for i in items],
        bulletType="bullet", start="•", leftIndent=12, spaceAfter=6,
    )


def table(rows, widths, header=True):
    data = []
    for r_i, row in enumerate(rows):
        cells = []
        for c in row:
            st = styles["CellH"] if (header and r_i == 0) else styles["Cell"]
            cells.append(Paragraph(str(c), st))
        data.append(cells)
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#d8cba8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), BLACK),
                  ("LINEBELOW", (0, 0), (-1, 0), 1, GOLD)]
    t.setStyle(TableStyle(style))
    return t


def rule():
    return HRFlowable(width="100%", thickness=0.6, color=GOLD, spaceBefore=2, spaceAfter=8)


# --- Page furniture ----------------------------------------------------------
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # top gold rule
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1)
    canvas.line(18 * mm, h - 16 * mm, w - 18 * mm, h - 16 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GOLD_DEEP)
    canvas.drawString(18 * mm, h - 13 * mm, "Izy Global Partners LLP — Library Management System")
    canvas.drawRightString(w - 18 * mm, h - 13 * mm, "Project Memory & Handoff")
    # footer
    canvas.setStrokeColor(colors.HexColor("#d8cba8"))
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK_SOFT)
    canvas.drawString(18 * mm, 10 * mm, "Confidential — internal handoff record")
    canvas.drawRightString(w - 18 * mm, 10 * mm, "Page %d" % doc.page)
    canvas.restoreState()


def on_cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(BLACK)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # crest: two gold discs (smaller + larger) with a gap
    cx, cy = w / 2, h - 70 * mm
    canvas.setFillColor(GOLD)
    canvas.circle(cx - 16 * mm, cy - 4 * mm, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(BLACK)
    canvas.circle(cx + 6 * mm, cy, 16 * mm, fill=1, stroke=0)  # gap knockout
    canvas.setFillColor(GOLD)
    canvas.circle(cx + 7 * mm, cy, 15 * mm, fill=1, stroke=0)
    canvas.restoreState()


def build():
    doc = DocTemplate(
        OUT, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=22 * mm, bottomMargin=18 * mm,
        title="IGP Library — Project Memory & Handoff", author="Izy Global Partners LLP",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id="main")
    cover_frame = Frame(0, 0, A4[0], A4[1], id="cover")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="body", frames=[frame], onPage=on_page),
    ])

    story = []
    today = datetime.date.today().isoformat()

    # ---- COVER ----
    story.append(Spacer(1, 95 * mm))
    story.append(Paragraph("Izy Global Partners LLP", styles["Cover"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Library Management System", styles["CoverSub"]))
    story.append(Paragraph("Legal &amp; Knowledge Resources Centre", styles["CoverSub"]))
    story.append(Spacer(1, 16 * mm))
    story.append(Paragraph("PROJECT MEMORY &amp; HANDOFF RECORD", styles["CoverSub"]))
    story.append(Paragraph("Definitive source of truth — Phase 1", styles["CoverSub"]))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Generated %s" % today, styles["CoverSub"]))
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    # ---- TOC ----
    story.append(Paragraph("Table of Contents", H1))
    story.append(rule())
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("toc0", fontName="Helvetica-Bold", fontSize=10.5, leading=18, textColor=INK),
        ParagraphStyle("toc1", fontName="Helvetica", fontSize=9.5, leading=15, leftIndent=14, textColor=INK_SOFT),
    ]
    story.append(toc)
    story.append(PageBreak())

    add_content(story, today)

    doc.multiBuild(story)
    print("Wrote", OUT)


# ----------------------------------------------------------------------------
from reportlab.platypus import NextPageTemplate


def add_content(story, today):
    # ========================= 1. OVERVIEW =========================
    story.append(h1("1. Project Overview"))
    story.append(rule())
    story.append(Paragraph(
        "The <b>Izy Global Partners LLP Library Management System</b> is an internal application for the firm's "
        "physical law library (the \"Legal &amp; Knowledge Resources Centre\") in Abuja, Nigeria. It manages a single "
        "combined catalogue, member (borrower) records, loan tracking, and the firm's law-report serial runs.", BODY))
    story.append(Paragraph("<b>Purpose &amp; goals:</b>", H3))
    story.append(bullets([
        "Give the firm Librarian one tool to catalogue holdings, register borrowers, and track loans.",
        "Hold the catalogue to firm standards: five fixed groupings, accession numbers <font face='Courier'>IGP-LIB-00001</font>, editions kept separate, copies rolled up.",
        "Track law-report serials (NWLR Part-by-Part; LRECN and others by volume) with searchable indexes.",
        "Produce dashboards and Excel/print reports.",
        "Run locally with no external subscriptions; production target is PostgreSQL.",
    ]))
    story.append(Paragraph("<b>Hard rules (firm policy, enforced in code):</b>", H3))
    story.append(bullets([
        "Firm name renders <b>exactly</b> as <font face='Courier'>Izy Global Partners LLP</font> (never \"IZY\").",
        "The five groupings are the only catalogue groupings: Textbooks; Laws / Statutes; Legal Books / Essays / Commentaries; Law Reports; Reference Collections.",
        "Document references use the format <font face='Courier'>IGP / ______</font> (never insert \"IOI\").",
        "Single collection: <font face='Courier'>Izy Global Partners LLP</font>. (The earlier second collection \"Alex. A. Izinyon &amp; Co.\" was removed.)",
        "Firm authorship is reserved for the founder <b>Alex Izinyon</b>. Alex A. Izinyon SAN is NOT the founder — so no titles are auto-tagged; currently 0 books are firm-authored.",
    ]))

    story.append(h2("1.1 Two-phase plan"))
    story.append(Paragraph(
        "<b>Phase 1 (BUILT):</b> single operator — the Librarian (role <font face='Courier'>admin</font>) — does all cataloguing, "
        "member management, loans, import and reporting.", BODY))
    story.append(Paragraph(
        "<b>Phase 2 (ARCHITECTED, NOT BUILT):</b> member logins (<font face='Courier'>members.linked_auth_uid</font>), member "
        "self-service (own history, holdings count, catalogue search, \"apply for loan\" via <font face='Courier'>loan_requests</font>), "
        "and a read-only Founder/Chairman (FC) dashboard. Roles <font face='Courier'>fc</font> and <font face='Courier'>member</font> and the "
        "<font face='Courier'>loan_requests</font> table exist but are inert. Textbook-selection authority is reserved to the FC by policy. See "
        "<font face='Courier'>ROADMAP.md</font>.", BODY))

    # ========================= 2. ARCHITECTURE =========================
    story.append(h1("2. Architecture &amp; Technical Design"))
    story.append(rule())
    story.append(code(
        "Browser (React + Vite SPA, vanilla CSS)\n"
        "   |  fetch JSON over /api ,  Authorization: Bearer <JWT>\n"
        "   v\n"
        "API server (Node + Express)  --  ALL business rules live here\n"
        "   |  SQL\n"
        "   v\n"
        "Database:  SQLite now (better-sqlite3)  ->  PostgreSQL in production"))
    story.append(bullets([
        "<b>Front end</b> holds no business logic about IDs/availability — it calls the API and renders. JWT kept in localStorage; a 401 clears it and returns to login.",
        "<b>API server</b> (<font face='Courier'>server/index.js</font>) owns auth, ID generation, duplicate roll-up, the loan lifecycle, merges, and the law-report/NWLR datasets. Every data route requires the <font face='Courier'>admin</font> role.",
        "<b>One source of truth: the database.</b> Derived values (copiesAvailable, loan Overdue status, NWLR held/available) are computed server-side so two devices always agree.",
        "<b>Dev runtime:</b> two processes — Vite (port 5173, HMR) + API (port 4000). Vite proxies <font face='Courier'>/api</font> to 4000.",
        "<b>Production runtime:</b> the API server also serves the built static app from <font face='Courier'>dist/</font>, same-origin on port 4000.",
    ]))
    story.append(Paragraph(
        "<b>Note on the launcher:</b> <font face='Courier'>Open IGP Library.command</font> runs <font face='Courier'>npm run dev</font> "
        "(port 5173) so the double-click experience matches manual dev exactly.", BODY2))

    # ========================= 3. TECH STACK =========================
    story.append(h2("2.1 Technology stack &amp; versions"))
    story.append(table([
        ["Layer", "Technology", "Version"],
        ["Frontend", "React + ReactDOM", "^18.3.1"],
        ["Build/dev", "Vite + @vitejs/plugin-react", "^5.2.11 / ^4.3.1"],
        ["Routing", "react-router-dom", "^6.23.1"],
        ["Spreadsheet", "SheetJS (xlsx)", "^0.18.5"],
        ["API server", "Express", "^4.19.2"],
        ["DB (local)", "better-sqlite3", "^11.3.0"],
        ["Auth", "jsonwebtoken + bcryptjs", "^9.0.2 / ^2.4.3"],
        ["CORS / dev runner", "cors / concurrently", "^2.8.5 / ^8.2.2"],
        ["Fonts", "Cormorant Garamond + Jost (Google Fonts)", "CDN, system fallback"],
        ["Runtime", "Node.js", "24 (works on 18+)"],
    ], [32 * mm, 95 * mm, 47 * mm]))

    # ========================= 4. FEATURES =========================
    story.append(h1("3. Implemented Features &amp; Status"))
    story.append(rule())
    story.append(table([
        ["Feature", "Status", "Notes"],
        ["Auth (email/password, JWT)", "Done", "Admin only; 12h token; no public sign-up"],
        ["Cataloguing add/edit/view", "Done", "All fields; validation; auto accession"],
        ["Duplicate detection + copy roll-up", "Done", "title+author+edition+publisher match"],
        ["Withdraw / mark missing (no hard delete)", "Done", "status change retains record"],
        ["Delete record (with confirm)", "Done", "Delete-permanently OR Withdraw; blocked if on loan"],
        ["Merge duplicate records", "Done", "POST /catalogue/merge — sums copies, deletes others"],
        ["Authors list + merge", "Done", "derived from author strings; rename across catalogue"],
        ["Author autocomplete in add form", "Done", "datalist of existing authors"],
        ["Search + relevance ranking", "Done", "scope All/Title/Author; fuzzy + ranked; filters dropdown"],
        ["Member management", "Done", "add/edit/active-inactive/notes; detail w/ loans"],
        ["Loan issue / return / renew", "Done", "transactional; reference-only & 0-stock blocked"],
        ["Overdue handling", "Done", "computed from dueDate vs today"],
        ["Excel import (SheetJS)", "Done", "column mapping; dedupe; preserve accession"],
        ["Dashboard", "Done", "totals, by grouping/collection, recent, overdue"],
        ["Reports (7) + Excel export + print", "Done", "overview, current, overdue, history, acquisitions, members, NWLR"],
        ["Law Reports tab (multi-series)", "Done", "NWLR (parts) + LRECN (volumes) + add more"],
        ["NWLR Parts held/missing + lookup + bands", "Done", "run to Part 2043; 810 held / 1233 missing"],
        ["Law-report indexes (searchable)", "Done", "NWLR 10, LRECN 3 index entries seeded"],
        ["Add report by part ranges; delete report", "Done", "\"200-500, 502-771\" bulk add; delete w/ confirm"],
        ["Reusable DataTable + pagination", "Done", "10/page, numbered jump-to-page, sortable"],
        ["Fixed sidebar + mobile hamburger drawer", "Done", "sidebar position:fixed; responsive drawer"],
        ["Phase 2 (member/FC)", "Stubbed", "routes + roles exist; render \"not available\""],
    ], [62 * mm, 18 * mm, 94 * mm]))

    # ========================= 5. DATA MODEL =========================
    story.append(h1("4. Database: Schema, Models, Relationships"))
    story.append(rule())
    story.append(Paragraph(
        "Local schema: <font face='Courier'>server/schema.sqlite.sql</font> (applied on every server start, idempotent). "
        "Production target: <font face='Courier'>db/schema.postgres.sql</font> (mirrors it with native enums/identity). "
        "The server maps snake_case columns to camelCase JSON (<font face='Courier'>server/db.js</font>).", BODY))
    story.append(table([
        ["Table", "Key", "Purpose"],
        ["users", "email (unique)", "Logins. Phase 1 = admin only. bcrypt password_hash."],
        ["settings", "id=1", "loanPeriodDays, renewalLengthDays, allowRenewals, firmName."],
        ["counters", "name", "Atomic sequences: accession / member / loan."],
        ["catalogue", "accession_number (unique)", "One row per bibliographic record."],
        ["members", "member_id (unique)", "Borrowers. linked_auth_uid = Phase 2 (null)."],
        ["loans", "loan_id (unique)", "One row per loan; book title + member name denormalised."],
        ["law_report_series", "abbreviation (unique)", "NWLR (kind=parts) / LRECN (kind=volumes) / others."],
        ["law_report_volumes", "id", "Held/Missing volumes for volume-based series."],
        ["law_report_indexes", "id", "Searchable index entries per series."],
        ["nwlr_parts", "part_no", "One row per NWLR Part: Held / Missing."],
        ["nwlr_config", "id=1", "upper_bound (2043), upper_provisional(0), serial_accession."],
        ["loan_requests", "id", "PHASE 2 SCAFFOLD — unused in Phase 1."],
    ], [40 * mm, 42 * mm, 92 * mm]))

    story.append(h2("4.1 Relationships &amp; invariants"))
    story.append(bullets([
        "<font face='Courier'>loans.accession_number → catalogue.accession_number</font>; <font face='Courier'>loans.member_id → members.member_id</font>. Loans denormalise book title + member name for fast lists.",
        "<font face='Courier'>law_report_volumes.series_id / law_report_indexes.series_id → law_report_series.id</font>; series links to its catalogue serial via <font face='Courier'>serial_accession</font>.",
        "copies_available is never &lt; 0 and never &gt; copies_total. A loan cannot be issued for Reference-only / Missing / Withdrawn items or when copies_available = 0.",
        "Issuing decrements availability (status → On loan at zero); returning restores it (→ Available). All transactional.",
        "Different editions = separate records; multiple copies of the same edition roll up into one record's copies_total.",
        "NWLR is ONE catalogue record; its ~2,000 Parts live in nwlr_parts so the title count is not inflated. Available Parts = Held Parts in [1, upper_bound].",
    ]))

    story.append(h2("4.2 Identifier strategy"))
    story.append(Paragraph(
        "Human IDs are formatted from integer counters incremented in the same transaction as the insert, so numbers never "
        "collide or reuse: <font face='Courier'>IGP-LIB-00001</font> (accession, 5-pad), <font face='Courier'>IGP-MEM-0001</font> "
        "(member, 4-pad), <font face='Courier'>IGP-LOAN-00001</font> (loan, 5-pad). On import, an existing accession is preserved "
        "and the counter bumped up via <font face='Courier'>ensureCounterAtLeast</font>.", BODY))

    story.append(h2("4.3 Current data (seeded + Librarian edits)"))
    story.append(table([
        ["Dataset", "Count"],
        ["Catalogue titles", "142 (incl. NWLR + LRECN serials)"],
        ["By grouping", "Laws/Statutes 50, Textbooks 43, Legal Books/Essays 38, Law Reports 8, Reference 3"],
        ["Members", "1"],
        ["Loans", "0 (history cleared before handoff)"],
        ["Law report series", "2 (NWLR, LRECN)"],
        ["LRECN volumes / indexes", "32 / 3"],
        ["NWLR Parts", "2043 (Held 810, Missing 1233; run to Part 2043)"],
        ["NWLR index entries", "10 (Comprehensive Index vols)"],
        ["Accession numbers", "issued to IGP-LIB-00145; 142 in use. Retired (never reused): 00065, 00131, 00132."],
    ], [55 * mm, 119 * mm]))
    story.append(Paragraph(
        "<b>Why 142 books but the highest number is 00145:</b> the accession counter only ever counts up and never reuses a "
        "number. Deleting or merging a record retires its accession (leaving a gap) so a number always points to one specific "
        "item. The next new book will be IGP-LIB-00146.", BODY2))
    story.append(Paragraph(
        "<b>Migrations are not formal files.</b> Schema is applied idempotently on start; one-off data changes were run as "
        "node scripts (collection consolidation, firm-authorship clearing, loan-history clear, NWLR extension to 2043). "
        "The seeded SQLite DB <font face='Courier'>server/data/igp-library.db</font> is committed to git so clones get identical data.", BODY2))

    # ========================= 6. API =========================
    story.append(h1("5. API Endpoints"))
    story.append(rule())
    story.append(Paragraph(
        "REST/JSON under <font face='Courier'>/api</font>. Auth: <font face='Courier'>POST /api/auth/login</font> returns a JWT "
        "(<font face='Courier'>{uid,email,role}</font>, 12h). All routes below require header "
        "<font face='Courier'>Authorization: Bearer &lt;token&gt;</font> and role <font face='Courier'>admin</font> "
        "(via <font face='Courier'>requireAdmin</font>). Secret: <font face='Courier'>IGP_JWT_SECRET</font>.", BODY))
    story.append(table([
        ["Method &amp; path", "Purpose"],
        ["POST /api/auth/login", "Authenticate → {token, user}"],
        ["GET /api/auth/me", "Resolve current user from token"],
        ["GET / PUT /api/settings", "Read / update settings"],
        ["GET /api/catalogue", "List all records"],
        ["GET /api/catalogue/:id", "One record"],
        ["POST /api/catalogue", "Create (accession auto unless preserved)"],
        ["PUT /api/catalogue/:id", "Update"],
        ["POST /api/catalogue/:id/copies", "Increment copy count (duplicate roll-up)"],
        ["PATCH /api/catalogue/:id/status", "Withdraw / missing / restore / reference"],
        ["DELETE /api/catalogue/:id", "Hard delete (blocked if copies on loan)"],
        ["POST /api/catalogue/merge", "Merge {keepId, mergeIds[]} — sum copies, delete others"],
        ["GET /api/authors", "Distinct author names + counts"],
        ["POST /api/authors/merge", "Replace {from[]} with {to} across catalogue"],
        ["GET/POST /api/members ; GET/PUT /api/members/:id", "Member CRUD"],
        ["GET /api/loans", "List loans (status computed)"],
        ["POST /api/loans", "Issue {bookId, memberId, dueDate?, notes?}"],
        ["POST /api/loans/:id/return", "Return"],
        ["POST /api/loans/:id/renew", "Renew (extend due date, ++renewedCount)"],
        ["GET /api/nwlr/status", "Held/missing counts, bands, flagged gaps"],
        ["GET /api/nwlr/parts?status=", "Parts list (Held/Missing) for export"],
        ["GET /api/nwlr/part/:n ; POST .../hold", "Lookup a Part ; flip Missing→Held"],
        ["PUT /api/nwlr/upper-bound", "Raise the run bound (new Parts default Held)"],
        ["GET/POST /api/law-reports", "List / create series (+ catalogue serial)"],
        ["GET /api/law-reports/:id", "Series detail (+ volumes)"],
        ["GET/POST /api/law-reports/:id/indexes", "Search / add index entries"],
        ["POST /api/law-reports/:id/volumes (+ /bulk)", "Add one volume / bulk by ranges"],
        ["PATCH /api/law-reports/volumes/:vid", "Toggle volume Held/Missing"],
        ["DELETE /api/law-reports/:id", "Delete series + volumes + indexes + serial record"],
    ], [78 * mm, 96 * mm]))
    story.append(Paragraph("<b>Example — issue a loan:</b>", H3))
    story.append(code(
        'POST /api/loans\n'
        'Authorization: Bearer <token>\n'
        '{ \"bookId\": 12, \"memberId\": 3, \"dueDate\": \"2026-07-01\", \"notes\": \"\" }\n'
        '-> 201 { loanId: \"IGP-LOAN-00001\", status: \"On loan\", dueDate, ... }'))

    # ========================= 7. FRONTEND =========================
    story.append(h1("6. Frontend Structure"))
    story.append(rule())
    story.append(bullets([
        "<font face='Courier'>src/main.jsx</font> → <font face='Courier'>App.jsx</font> (BrowserRouter). Routes guarded by <font face='Courier'>ProtectedRoute</font> (allow=[ROLES.ADMIN]) inside <font face='Courier'>Layout</font>.",
        "<b>State:</b> React local state + <font face='Courier'>context/AuthContext.jsx</font> (token-based auth: signIn/signOut, user, role, loading). No Redux. Data fetched per-page via <font face='Courier'>lib/*</font> API clients.",
        "<b>Routing:</b> / (Dashboard), /catalogue, /catalogue/new, /catalogue/:id, /catalogue/:id/edit, /search, /members(+new/:id/edit), /loans(+new), /law-reports(+/:id), /nwlr, /authors, /import, /reports, /settings, /login. Phase-2 stubs at /member/* and /fc/*.",
    ]))
    story.append(h2("6.1 Components &amp; pages"))
    story.append(table([
        ["File", "Purpose"],
        ["components/DataTable.jsx", "Reusable sortable table; 10/page; numbered pagination"],
        ["components/Pagination.jsx", "Prev/Next + numbered jump-to-page (windowed)"],
        ["components/Layout / Masthead / Sidebar", "Shell: fixed sidebar, sticky masthead, mobile hamburger"],
        ["components/Modal.jsx", "Accessible modal (used by delete/add-series/duplicate)"],
        ["components/IndexSearch.jsx", "Search + add index entries for a law-report series"],
        ["components/StatusBadge / Spinner", "Status pills; loading spinner"],
        ["pages/Catalogue/*", "List, BookForm (add/edit + duplicate modal + author picker), BookDetail (status, delete, merge)"],
        ["pages/Search.jsx", "Relevance search, scope, filters dropdown"],
        ["pages/Members/*", "List, MemberForm, MemberDetail (loans + history)"],
        ["pages/Loans/*", "LoanList (filters), IssueLoan (searchable clickable book picker)"],
        ["pages/LawReports/*", "LawReportsList (cards + add modal), LawReportSeries (volumes, ranges, delete)"],
        ["pages/Nwlr/NwlrPage.jsx", "Parts held/missing, bands, gaps, lookup, exports, indexes"],
        ["pages/Authors/AuthorsPage.jsx", "Author list + merge tool"],
        ["pages/Reports/ReportsPage.jsx", "7 reports, Excel export, print"],
        ["pages/Import/ImportPage.jsx", "SheetJS upload, column mapping, dedupe, bulk insert"],
        ["pages/Settings/SettingsPage.jsx", "Loan period, renewal, toggles"],
        ["lib/*.js", "API clients: api, catalogue, members, loans, nwlr, lawreports, settings, excel, format, constants"],
        ["styles/theme.css / app.css", "Brand tokens (black/gold, squared edges) + all component CSS"],
    ], [62 * mm, 112 * mm]))
    story.append(Paragraph(
        "<b>Design language:</b> squared edges (no curves), editorial serif (Cormorant Garamond) headings + Jost UI font, "
        "logo gold <font face='Courier'>#ceaa51</font>. Masthead crest = <font face='Courier'>public/logo-crest.png</font> "
        "(cropped from the real two-disc logo). Login uses full <font face='Courier'>public/logo.png</font>.", BODY2))

    # ========================= 8. BACKEND =========================
    story.append(h1("7. Backend Structure"))
    story.append(rule())
    story.append(table([
        ["File", "Purpose"],
        ["server/index.js", "Express app; all routes; auth middleware; business logic; serves dist/ in prod"],
        ["server/db.js", "better-sqlite3 connection; applies schema; ID generation; row→API mappers"],
        ["server/schema.sqlite.sql", "Local schema (idempotent CREATE TABLE IF NOT EXISTS)"],
        ["server/createAdmin.js", "Bootstrap/refresh the Librarian login (bcrypt)"],
        ["server/seedHoldings.js", "Import the 122 book holdings + NWLR serial/Parts (idempotent)"],
        ["server/seedLawReports.js", "Register NWLR series, create LRECN + volumes + indexes; textbooks"],
        ["db/schema.postgres.sql", "Production PostgreSQL DDL (enums, identity, FKs, indexes)"],
    ], [55 * mm, 119 * mm]))
    story.append(Paragraph(
        "<b>Business logic notes:</b> role check is <font face='Courier'>requireRole('admin')</font> (structured to add fc/member "
        "in Phase 2). Loan issue/return are SQLite transactions. NWLR bands are generated dynamically in 500-Part chunks up to "
        "the upper bound. Range parsing (\"200-500, 502-771\") via <font face='Courier'>parseRanges()</font>.", BODY))

    # ========================= 9. CONFIG / DEPLOY =========================
    story.append(h1("8. Configuration, Environment &amp; Deployment"))
    story.append(rule())
    story.append(table([
        ["Variable", "Default", "Purpose"],
        ["IGP_API_PORT", "4000", "API / production server port"],
        ["IGP_JWT_SECRET", "igp-dev-secret-change-me", "JWT signing secret — SET IN PRODUCTION"],
        ["IGP_DB_FILE", "server/data/igp-library.db", "SQLite file location"],
        ["PORT (Vite)", "5173", "Dev web server (vite.config.js)"],
    ], [42 * mm, 60 * mm, 72 * mm]))
    story.append(bullets([
        "<b>Local install:</b> <font face='Courier'>npm install</font> (better-sqlite3 ships prebuilt binaries).",
        "<b>First admin:</b> <font face='Courier'>npm run create-admin -- &lt;email&gt; &lt;password&gt;</font>. No public sign-up.",
        "<b>Dev:</b> <font face='Courier'>npm run dev</font> → API :4000 + Vite :5173 (proxy /api). Double-click <font face='Courier'>Open IGP Library.command</font> does the same.",
        "<b>Production build:</b> <font face='Courier'>npm run build</font> → <font face='Courier'>dist/</font>; <font face='Courier'>node server/index.js</font> serves app + API same-origin on :4000.",
        "<b>Production DB:</b> CTO implements <font face='Courier'>db/schema.postgres.sql</font>, swaps the data layer in server/* to a pg client (same REST contract). Frontend unchanged.",
        "<b>Backups:</b> SQLite = copy the .db file; Postgres = pg_dump.",
    ]))

    # ========================= 10. THIRD PARTY =========================
    story.append(h1("9. Third-Party Services &amp; Libraries"))
    story.append(rule())
    story.append(bullets([
        "<b>SheetJS (xlsx)</b> — client-side Excel import (column mapping) and all report/list exports.",
        "<b>better-sqlite3</b> — synchronous embedded SQLite (dev/testing DB).",
        "<b>express, cors</b> — HTTP API. <b>jsonwebtoken, bcryptjs</b> — auth.",
        "<b>react-router-dom</b> — SPA routing. <b>concurrently</b> — runs API + Vite together.",
        "<b>Google Fonts</b> (Cormorant Garamond, Jost) loaded via CDN in <font face='Courier'>index.html</font>; degrades to Georgia/system if offline.",
        "<b>No external accounts, no Firebase, no analytics, no payment.</b> (Firebase was explicitly removed early on.)",
    ]))

    # ========================= 11. DECISIONS =========================
    story.append(h1("10. Key Decisions, Assumptions &amp; Tradeoffs"))
    story.append(rule())
    story.append(bullets([
        "<b>Dropped Firebase</b> for a local Node+SQLite backend (no subscriptions, runs offline) with a PostgreSQL schema for the CTO. The REST contract is the stable boundary.",
        "<b>NWLR as one serial + a Parts dataset</b> (not ~2,000 catalogue rows) keeps the title count honest; available = held Parts in range.",
        "<b>Authors stored as a semicolon-delimited string</b> on the record (no authors table). Author list/merge are derived operations — lighter, but author identity is by exact name.",
        "<b>Merge deletes the merged catalogue rows</b>; loan history keeps its denormalised title/accession, so history survives.",
        "<b>IDs are numbers in JSON</b> — the loan-issue bug was a string/number comparison; always compare with String() in selects.",
        "<b>The committed SQLite DB carries real data</b> so clones are identical; transient -wal/-shm are gitignored; checkpoint before committing.",
        "<b>Firm authorship is manual</b> and currently empty (founder is Alex Izinyon, not Alex A. Izinyon SAN).",
        "<b>Squared, black-and-gold luxury UI</b>; fixed sidebar; mobile hamburger; reusable DataTable with numbered pagination.",
    ]))

    # ========================= 12. KNOWN ISSUES / ROADMAP =========================
    story.append(h1("11. Outstanding Tasks, Known Issues &amp; Roadmap"))
    story.append(rule())
    story.append(Paragraph("<b>Known issues / technical debt:</b>", H3))
    story.append(bullets([
        "No automated tests yet (no unit/integration/e2e). Verification has been manual + one-shot builds.",
        "JS bundle &gt; 500 kB (xlsx is large) — consider code-splitting / lazy import of the import/report pages.",
        "Author identity is by exact string; near-duplicate names need the merge tool (no fuzzy auto-merge).",
        "SQLite CHECK constraints on the existing committed DB still allow the old second collection value (harmless; data migrated). Fresh installs use the tightened schema.",
        "Loan issue/renew/return not yet click-tested in this session after the fix (compiles; logic corrected).",
        "No rate limiting / lockout on login; dev JWT secret must be overridden in production.",
    ]))
    story.append(Paragraph("<b>Roadmap (Phase 2 — see ROADMAP.md):</b>", H3))
    story.append(bullets([
        "Member logins via members.linked_auth_uid; enable ROLES.member route guards.",
        "Member self-service: own history, holdings count, catalogue search, \"apply for loan\" → loan_requests → Librarian approval.",
        "FC read-only dashboard (ROLES.fc); textbook-selection authority reserved to FC.",
        "Migrate to PostgreSQL (db/schema.postgres.sql) for multi-device firm-wide use.",
    ]))

    # ========================= 13. WORKFLOW =========================
    story.append(h1("12. Development Workflow, Testing &amp; Release"))
    story.append(rule())
    story.append(bullets([
        "<b>Repo:</b> git, remote <font face='Courier'>origin</font> = github.com/ibogunjobi-dev/igp-library-software.git. The Librarian commits &amp; pushes herself; the assistant does not push.",
        "<b>Commit flow for data edits:</b> stop the app (flush WAL), then <font face='Courier'>git add -A &amp;&amp; git commit &amp;&amp; git push</font> from the project root. The .db is tracked so app edits version with the code.",
        "<b>Testing:</b> currently manual via the running app + <font face='Courier'>npm run build</font> as a compile check. No test framework installed yet.",
        "<b>Release:</b> <font face='Courier'>npm run build</font> then serve via <font face='Courier'>node server/index.js</font>, or hand the Postgres schema + static build to the CTO.",
    ]))

    # ========================= 14. CONVERSATION CONTEXT =========================
    story.append(h1("13. Important Context &amp; Decisions Log"))
    story.append(rule())
    story.append(Paragraph(
        "Chronological context an engineer/AI must know (these were explicit user decisions during development):", BODY))
    story.append(bullets([
        "Firebase was removed in favour of local SQLite + a Postgres schema for the CTO.",
        "Real holdings imported from <font face='Courier'>IGP_Library_Catalogue.xlsx</font> (122 books) as already-registered; accession numbers preserved.",
        "NWLR missing-Parts list reconciles to exactly 1,233; run later extended to Part 2043 (1999–2043 added as Held).",
        "Logo: the two circles do NOT overlap into a blob — there is a real gap; the crest is cropped from the actual logo PNG.",
        "\"Alex. A. Izinyon &amp; Co.\" collection removed; founder is Alex Izinyon (not Alex A. Izinyon SAN) so no firm-authored titles.",
        "Project lives at <font face='Courier'>~/Development/igp-library</font> (moved from ~/igp-library).",
        "Loan history was cleared before handoff (0 loans, counter reset).",
        "LRECN added (32 volumes); LRECN indexes (3 ranges) + NWLR Comprehensive Index (10 vols) seeded.",
        "Every table was made a reusable component with 10/page numbered pagination; sidebar fixed; mobile hamburger added.",
    ]))

    # ========================= 15. AI CONTINUATION BRIEF =========================
    story.append(PageBreak())
    story.append(h1("14. AI Continuation Brief"))
    story.append(rule())
    story.append(Paragraph(
        "<i>This section lets a fresh AI session resume immediately with no prior context.</i>", BODY2))

    story.append(Paragraph("<b>Current project state</b>", H3))
    story.append(Paragraph(
        "Phase 1 is functionally complete and runs locally. Frontend (React/Vite) + API (Express) + SQLite. "
        "Repo at <font face='Courier'>~/Development/igp-library</font>, remote set, the Librarian commits/pushes herself. "
        "Latest commit: \"Loan issue fixed\". The seeded SQLite DB is committed (clones get identical data).", BODY))

    story.append(Paragraph("<b>What was completed</b>", H3))
    story.append(Paragraph(
        "Auth; full cataloguing (add/edit/view/withdraw/delete/merge); duplicate detection + copy roll-up; author "
        "list/merge + autocomplete; relevance search with scope &amp; filters; members; loans (issue/return/renew, "
        "overdue); Excel import; dashboard; 7 reports with Excel/print; Law Reports (NWLR Parts + LRECN volumes + "
        "indexes + add-by-range + delete); reusable paginated DataTable; fixed sidebar + mobile hamburger; black/gold "
        "squared luxury UI; correct cropped logo crest; loan history cleared.", BODY))

    story.append(Paragraph("<b>In progress / not yet verified</b>", H3))
    story.append(bullets([
        "Loan-issue fix (string/number ID comparison) compiles but was not click-tested live in the last session.",
        "Uncommitted working-tree changes may exist (the user commits manually) — run <font face='Courier'>git status</font> first.",
    ]))

    story.append(Paragraph("<b>What to do next (suggested)</b>", H3))
    story.append(bullets([
        "Click-test issue/return/renew end to end; confirm availability + status transitions.",
        "Add a minimal test suite (Vitest for lib/* + a few API tests with supertest).",
        "Code-split heavy pages (import/reports) to shrink the bundle.",
        "When ready for multi-device: implement db/schema.postgres.sql and swap server/* data layer to pg.",
        "Begin Phase 2 only when asked (member logins, loan_requests flow, FC read-only).",
    ]))

    story.append(Paragraph("<b>Critical files</b>", H3))
    story.append(table([
        ["File", "Why it matters"],
        ["server/index.js", "All API routes + business rules; start here for backend changes"],
        ["server/db.js + schema.sqlite.sql", "DB connection, ID generation, schema"],
        ["db/schema.postgres.sql", "Production DB target for the CTO"],
        ["src/lib/*.js", "API clients + pure helpers (constants, format, excel)"],
        ["src/components/DataTable.jsx + Pagination.jsx", "Every list uses these"],
        ["src/pages/Loans/IssueLoan.jsx", "Recently fixed; book picker + ID coercion"],
        ["src/styles/theme.css + app.css", "Brand tokens + all styling"],
        ["server/data/igp-library.db", "The live data (committed) — back up before edits"],
        ["README.md / ROADMAP.md / IMPORT-NOTES.md / docs/TECHNICAL-OVERVIEW.md", "Existing docs"],
    ], [70 * mm, 104 * mm]))

    story.append(Paragraph("<b>Commands to run the project</b>", H3))
    story.append(code(
        "cd ~/Development/igp-library\n"
        "npm install\n"
        "npm run create-admin -- librarian@izyglobalpartners.com \"<password>\"\n"
        "npm run dev          # API :4000 + Vite :5173 (open http://localhost:5173)\n"
        "#  or double-click 'Open IGP Library.command'\n"
        "npm run build        # production static build into dist/\n"
        "node server/index.js # serve app + API on :4000 (after build)\n"
        "node server/seedHoldings.js \"/path/IGP_Library_Catalogue.xlsx\"  # (re)seed books\n"
        "node server/seedLawReports.js                                    # seed law reports"))

    story.append(Paragraph("<b>Common pitfalls &amp; implementation notes</b>", H3))
    story.append(bullets([
        "IDs are numbers in JSON but strings in form/select values — ALWAYS compare with String() (this caused the loan bug).",
        "Don't launch a dev server unless asked; the Librarian often runs the app herself. Prefer <font face='Courier'>npm run build</font> as a compile check.",
        "Do NOT commit or push unless asked — the Librarian handles git. Before she commits data edits, stop the app to flush the SQLite WAL into the .db.",
        "Firm name must be exactly \"Izy Global Partners LLP\"; only the five groupings; doc refs \"IGP / ___\".",
        "No firm-authored titles (founder = Alex Izinyon). Single collection only.",
        "NWLR is special (parts model + nwlr_config); other law reports use the volumes model. New parts-style reports use volume entries via the range bulk-add.",
        "better-sqlite3 is synchronous; loan issue/return run inside db.transaction(); keep Overdue computed, never stored.",
        "Schema is applied on every server start (idempotent). Adding a column to an existing committed DB needs a migration script, not just a schema edit.",
    ]))

    story.append(Spacer(1, 6))
    story.append(rule())
    story.append(Paragraph(
        "End of project memory. This document plus the git repository fully reconstitute the project.", BODY2))


if __name__ == "__main__":
    build()
