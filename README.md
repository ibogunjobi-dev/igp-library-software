# Izy Global Partners LLP — Library Management System

A Library Management System for **Izy Global Partners LLP** ("IGP" / "the firm"),
the firm's **Legal & Knowledge Resources Centre**. It manages a single combined
catalogue, member (borrower) records, and loan tracking for the firm's physical
library.

This repository implements **Phase 1** (the single-operator Librarian console).
The data model, roles and routes are architected so that **Phase 2** (member
logins, member self-service, and a read-only Founder/Chairman dashboard) can be
added later without re-architecting. See [`ROADMAP.md`](./ROADMAP.md).

---

## Architecture

- **Frontend:** React + Vite, vanilla CSS (no Tailwind, no UI framework).
- **Backend (local / testing):** a small bundled **Node + Express** API with a
  **SQLite** database (`better-sqlite3`). Runs locally with no external accounts
  or subscriptions. Sign-in is email/password with a JWT session.
- **Production database:** **PostgreSQL.** A ready-to-implement schema is
  provided in [`db/schema.postgres.sql`](./db/schema.postgres.sql) for the CTO.
  The local SQLite schema ([`server/schema.sqlite.sql`](./server/schema.sqlite.sql))
  mirrors it; the API layer is the same regardless of database.
- **Spreadsheet import/export:** SheetJS (`xlsx`), client-side.

> The local SQLite server exists so the application is fully runnable and
> testable now. For production, the CTO implements the Postgres schema and the
> same REST contract (see "API contract" below); the React app is unchanged.

---

## Quick start (non-technical) — double-click to open

On a Mac with Node.js installed, simply **double-click `Open IGP Library.command`**
in the project folder (`~/Development/igp-library`). It installs components on
first run, builds the app, starts the local server, and opens the Library in your
browser at <http://localhost:4000>. Keep the Terminal window open while using it;
close it to stop. (First launch, macOS may ask you to confirm opening a file from
an unidentified developer: right-click → Open the first time.)

A document explaining how the whole system works, how the pieces synchronise, and
the database (both the SQLite one used now and the PostgreSQL one for the CTO) is
in [`docs/TECHNICAL-OVERVIEW.md`](./docs/TECHNICAL-OVERVIEW.md).

---

## Prerequisites

- Node.js 18+ and npm. (Developed and tested on Node 24.)

## 1. Install

```bash
npm install
```

`better-sqlite3` ships prebuilt binaries for common platforms; no database
server or configuration is required for local use.

## 2. Create the first admin (Librarian) account

There is **no public sign-up**. Create the Librarian account with the bootstrap
script (it creates the SQLite database on first run):

```bash
npm run create-admin -- librarian@izyglobalpartners.example "a-strong-password"
```

Re-running with the same email updates that admin's password. Passwords are
stored as bcrypt hashes.

## 3. Run in development

```bash
npm run dev
```

This starts **both** processes via `concurrently`:

- the API server on <http://localhost:4000>, and
- the Vite dev server on <http://localhost:5173> (opens automatically).

Vite proxies `/api` to the API server, so you only interact with port 5173.
Sign in as the Librarian.

You can also run them separately: `npm run server` and, in another terminal,
`npm run web`.

## 4. Build & preview (production bundle)

```bash
npm run build       # outputs the static app to dist/
npm run server      # the API server also serves dist/ as a single-page app
```

With a build present, the Express server serves the app and the API from one
origin (default <http://localhost:4000>), so no proxy is needed in production.

---

## Configuration (environment variables)

All optional for local use; sensible defaults are applied.

| Variable          | Default                     | Purpose                                  |
|-------------------|-----------------------------|------------------------------------------|
| `IGP_API_PORT`    | `4000`                      | API server port.                         |
| `IGP_DB_FILE`     | `server/data/igp-library.db`| SQLite database file location.           |
| `IGP_JWT_SECRET`  | dev placeholder             | **Set a strong secret in any shared/production deployment.** |

---

## Importing existing holdings

Use **Administration → Import holdings**. Upload the existing `.xlsx`/`.csv`,
then **map the spreadsheet's own column headings** to catalogue fields (the
importer auto-guesses common headings and lets you correct them). The importer:

- previews the rows and the resulting records before anything is written;
- preserves existing accession numbers and generates `IGP-LIB-NNNNN` where
  absent (the counter is kept ahead of preserved numbers so they never collide);
- runs **duplicate detection** (title + author + edition + publisher) and rolls
  same-edition duplicates up into a single record's copy count;
- pre-tags the Founder/Chairman's two authored titles
  (*Modern Nigerian Law of Contract*, *Through the Cases*) as firm authorship.

> No fixed column layout is assumed — supply the spreadsheet and map its
> headings on the upload screen. **Nothing is written until you confirm on the
> preview step.**

### Bulk seed from the master holdings register (scripted)

The firm's master register and the NWLR run can also be loaded in one step,
preserving accession numbers and applying the standing author/publisher rules:

```bash
npm run seed -- "/path/to/IGP_Library_Catalogue.xlsx"
```

This is idempotent (safe to re-run): a row whose accession already exists is
skipped, and same-edition duplicates roll up into a copy count. It also:

- creates the single **NWLR serial record** (one catalogue title — it does
  **not** inflate the book count), and seeds the **NWLR Parts dataset**
  (1 → upper bound) marking the 1,233 not-held Parts as *Missing*;
- standardises Princeton publisher variants, sets Olakanmi compilations to
  *Olajide Olakanmi* and Nigerian Law School handbooks to the *Council of Legal
  Education, Nigerian Law School*, and pre-tags the FC's two authored titles;
- marks any blank author/publisher as **"To supply"** (never invented);
- writes **`IMPORT-NOTES.md`** (source, totals, accession range, exceptions,
  open NWLR items).

The **NWLR holdings** screen (sidebar) shows held vs missing by band, the large
contiguous gaps flagged for shelf re-check, a per-Part lookup, and a control to
mark a Part as held once acquired and to raise the provisional upper bound.

---

## API contract (for the production backend)

The frontend talks to these endpoints (all except login require a
`Bearer` token; Phase 1 requires the `admin` role):

```
POST   /api/auth/login            -> { token, user:{ email, role } }
GET    /api/auth/me               -> { user }
GET    /api/settings              PUT /api/settings
GET    /api/catalogue             POST /api/catalogue
GET    /api/catalogue/:id         PUT /api/catalogue/:id
POST   /api/catalogue/:id/copies  PATCH /api/catalogue/:id/status
GET    /api/members               POST /api/members
GET    /api/members/:id           PUT /api/members/:id
GET    /api/loans                 POST /api/loans
POST   /api/loans/:id/return      POST /api/loans/:id/renew
GET    /api/nwlr/status           GET  /api/nwlr/part/:n
POST   /api/nwlr/part/:n/hold     PUT  /api/nwlr/upper-bound
```

JSON objects are camelCase (e.g. `accessionNumber`, `copiesAvailable`,
`firmAuthorship`, `keywords` as a string array). The CTO's Postgres
implementation should preserve this contract; the React app then needs no change
beyond pointing at the production API base.

---

## Key conventions

- The firm name renders exactly as **`Izy Global Partners LLP`** everywhere.
- The five catalogue groupings are fixed: *Textbooks*; *Laws / Statutes*;
  *Legal Books / Essays / Commentaries*; *Law Reports*; *Reference Collections*.
- Accession numbers follow `IGP-LIB-00001`; member IDs `IGP-MEM-0001`; loan IDs
  `IGP-LOAN-00001`. Document references use the format `IGP / ______`.
- Different editions are **separate records**; multiple copies of the same
  edition are **one record with a copy count**.
- *Reference only*, *Missing* and *Withdrawn* items cannot be loaned, and a
  record with zero available copies cannot be loaned. Availability and these
  rules are enforced transactionally on the server.

---

## Project structure

```
src/
  lib/         REST API client, constants, Excel import/export, formatting,
               duplicate detection
  context/     Authentication context (token-based, role-aware)
  components/  Masthead, sidebar, layout, route guard, shared UI
  pages/       Dashboard, Catalogue, Search, Members, Loans, Import, Reports, Settings
  pages/phase2 Phase 2 route stubs (not built — see ROADMAP.md)
  styles/      theme.css (brand tokens), app.css (layout/components)
server/
  index.js          Express API (auth + data routes; serves dist/ in production)
  db.js             SQLite connection, schema bootstrap, row<->API mapping, IDs
  schema.sqlite.sql Local/testing schema
  createAdmin.js    First-admin bootstrap
db/
  schema.postgres.sql  PRODUCTION schema for the CTO (mirrors the SQLite one)
```
