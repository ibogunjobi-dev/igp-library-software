# Izy Global Partners LLP — Library Management System
## Technical Overview & Database Handoff

_Legal & Knowledge Resources Centre — Phase 1._

This document explains **what the application is, how the pieces fit together
and synchronise, and how the data is stored** — covering both the **SQLite**
database used now for running and testing, and the **PostgreSQL** database the
CTO is to stand up for production. The PostgreSQL section is written so it can
be implemented directly from the supplied DDL.

---

## 1. What the system is

A single-operator library system for the firm's physical library. In **Phase 1**
the only user who signs in is the **Librarian** (role `admin`). The Librarian
catalogues holdings, maintains borrower (member) records, and issues / returns /
renews loans. The system also tracks the **Nigerian Weekly Law Reports (NWLR)**
serial run Part-by-Part.

The firm name renders **exactly** as `Izy Global Partners LLP` everywhere.
Catalogue groupings are fixed to the five firm groupings. Accession numbers
follow `IGP-LIB-00001`.

Roles `fc` (Founder/Chairman, read-only) and `member` (borrower self-service)
exist in the data model and access checks but are **inert in Phase 1** — see
`ROADMAP.md`.

---

## 2. Architecture — how the tech synchronises

```
┌─────────────────────────┐     HTTPS/HTTP, JSON over /api      ┌──────────────────────────┐
│  Browser (React SPA)     │  ───────────────────────────────▶ │  API server (Node/Express) │
│  Vite build, vanilla CSS │  ◀─────────────────────────────── │  REST endpoints + auth     │
│  Bearer token in storage │     JSON responses                 │  All business rules here   │
└─────────────────────────┘                                     └────────────┬─────────────┘
                                                                              │ SQL
                                                                 ┌────────────▼─────────────┐
                                                                 │  Database                 │
                                                                 │  SQLite now → PostgreSQL  │
                                                                 └──────────────────────────┘
```

**Front end** — React + Vite single-page app, vanilla CSS (brand tokens in
`src/styles/theme.css`). It holds **no business logic about availability or IDs**;
it calls the API and renders results. The auth token (JWT) is kept in
`localStorage` and sent as `Authorization: Bearer <token>` on every request
(`src/lib/api.js`). A `401` clears the token and returns the user to the login
screen.

**API server** — `server/index.js` (Express). It owns **all the rules**:
authentication, role checks, ID generation, duplicate roll-up, the loan
lifecycle (decrement/restore availability, block reference-only or zero-stock
loans), and the NWLR Part dataset. Every data route requires the `admin` role in
Phase 1. This is the layer the CTO re-points from SQLite to PostgreSQL — **the
HTTP contract does not change.**

**Database** — currently SQLite (file on disk); production target PostgreSQL.
The server maps `snake_case` columns to `camelCase` JSON for the API
(`server/db.js`).

### How synchronisation works
- There is **one source of truth: the database.** The browser never writes
  directly; it always goes through the API, which writes transactionally.
- Derived values (`copiesAvailable`, loan `Overdue` status, NWLR held/available
  counts) are **computed server-side** so two devices hitting the same server
  always agree.
- **Dev mode:** two processes — Vite dev server (port 5173, hot reload) and the
  API (port 4000). Vite proxies `/api` → `4000` (see `vite.config.js`), so the
  browser only ever talks to one origin.
- **Production / "double-click" mode:** one process — the API server also serves
  the built static app from `dist/`, so the app and its data are same-origin on
  port 4000. The `Open IGP Library.command` launcher uses this mode.

---

## 3. Running it

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Dev (web + API, hot reload) | `npm run dev` → web on `:5173`, API on `:4000` |
| Create / reset the Librarian login | `npm run create-admin -- <email> <password>` |
| Seed all IGP holdings (idempotent) | `node server/seedHoldings.js "/path/to/IGP_Library_Catalogue.xlsx"` |
| Production build | `npm run build` (outputs `dist/`) |
| Serve production build | `node server/index.js` (serves `dist/` + API on `:4000`) |
| **Open the app (non-technical)** | Double-click **`Open IGP Library.command`** |

Environment variables (all optional in dev):

| Variable | Default | Purpose |
|---|---|---|
| `IGP_API_PORT` | `4000` | API / production server port |
| `IGP_JWT_SECRET` | dev secret | **Set a strong secret in production** |
| `IGP_DB_FILE` | `server/data/igp-library.db` | SQLite file location |

---

## 4. Data model (entities & relationships)

| Entity | Key | Notes |
|---|---|---|
| `users` | `email` (unique) | Logins. Phase 1 only `admin`. Password is bcrypt-hashed. |
| `settings` | single row (`id=1`) | Loan period, renewal length, firm name. |
| `counters` | `name` | Atomic sequences for `accession` / `member` / `loan` IDs. |
| `catalogue` | `accession_number` (unique) | One row per bibliographic record. |
| `members` | `member_id` (unique) | Borrowers. `linked_auth_uid` reserved for Phase 2. |
| `loans` | `loan_id` (unique) | One row per loan event; book title + member name denormalised. |
| `nwlr_parts` | `part_no` | One row per NWLR Part: `Held` / `Missing`. |
| `nwlr_config` | single row (`id=1`) | Run upper bound + the NWLR serial's accession. |
| `loan_requests` | — | **Phase 2 scaffold**, unused in Phase 1. |

**Relationships:** `loans.accession_number → catalogue.accession_number`;
`loans.member_id → members.member_id`. Loans **denormalise** `book_title` and
`member_name` so lists render without extra joins (kept in step on write).

### Identifier strategy (important)
Human-readable IDs are formatted from integer counters held in `counters`:
- `accession` → `IGP-LIB-00001` (5-digit zero-pad)
- `member` → `IGP-MEM-0001` (4-digit)
- `loan` → `IGP-LOAN-00001` (5-digit)

On each insert the server **increments the counter inside the same transaction**
as the row insert, so numbers never collide or get reused. On import, an existing
accession number is **preserved** and the counter is bumped up to at least that
value (`ensureCounterAtLeast`).

### Key invariants enforced by the API (not the UI)
- `copies_available` is never `< 0` and never `> copies_total`.
- A loan cannot be issued for an item that is `Reference only` / `Missing` /
  `Withdrawn`, or when `copies_available = 0`.
- Issuing decrements availability (and flips the record to `On loan` at zero);
  returning restores it (and back to `Available`). All transactional.
- Different **editions** are separate records; multiple **copies of the same
  edition** roll up into one record's `copies_total`.

### The five groupings (only these)
`Textbooks` · `Laws / Statutes` · `Legal Books / Essays / Commentaries` ·
`Law Reports` · `Reference Collections`.

### NWLR model (why it does not inflate the catalogue)
NWLR is **one** catalogue record (a serial, grouping `Law Reports`). Its ~2,000
individual Parts live in `nwlr_parts`, **not** in `catalogue`, so the title count
is not inflated. A Part is `Missing` if it is in the not-held set, otherwise
`Held`. **Available Parts = all Held Parts in `[1, upper_bound]`** — computed,
never typed. Current state: run held through **Part 2043** (Parts 1999–2043
held), **1,233** Parts missing, **810** held. The Librarian can flip a Part
`Missing → Held` when acquired, and raise the upper bound.

---

## 5. The SQLite database (now — running & testing)

- **Engine:** `better-sqlite3` (synchronous, embedded — no separate service).
- **File:** `server/data/igp-library.db` (plus `-wal` / `-shm` while running).
  This file **is** the database; back it up by copying it. It is gitignored.
- **Schema:** applied automatically on server start from
  `server/schema.sqlite.sql` (idempotent — `CREATE TABLE IF NOT EXISTS`).
- **Seeding:** `server/seedHoldings.js` loads the 122 book records + the NWLR
  serial and Part dataset; it is idempotent (safe to re-run) and writes
  `IMPORT-NOTES.md`.
- **Booleans** are stored as `0/1`; **keywords** as a JSON text array;
  **dates** as ISO strings (`YYYY-MM-DD`).

SQLite is intended for single-machine use. For multi-device / firm-wide use,
move to PostgreSQL (next section).

---

## 6. The PostgreSQL database (CTO — production target)

The complete, ready-to-run DDL is in **`db/schema.postgres.sql`**. It mirrors the
SQLite schema exactly, using native Postgres types. This section gives the CTO
everything needed to stand it up and connect the app.

### 6.1 Stand up the database
```bash
createdb igp_library
psql -d igp_library -f db/schema.postgres.sql
```
The script creates the enum types, tables, indexes, and seeds the singleton
`settings`, `counters`, and `nwlr_config` rows.

### 6.2 What the schema gives you
- **Enums** for every controlled vocabulary: `user_role`, `catalogue_grouping`
  (the five groupings), `catalogue_collection`, `catalogue_status`,
  `member_type`, `member_status`, `loan_status`, `loan_request_status`,
  `nwlr_part_status`. Using enums enforces the vocabularies at the DB level.
- **Identity columns** (`BIGINT GENERATED ALWAYS AS IDENTITY`) for surrogate
  keys, plus the **`counters`** table for the formatted business IDs
  (`IGP-LIB-*`, `IGP-MEM-*`, `IGP-LOAN-*`).
- **Foreign keys**: `loans → catalogue(accession_number)` and
  `loans → members(member_id)`; `nwlr_config.serial_accession → catalogue`.
- **Check constraints** mirroring the invariants, including
  `copies_available <= copies_total`.
- **Types:** `keywords` is `JSONB` (array of strings); booleans are real
  `BOOLEAN`; dates are `DATE`; timestamps are `TIMESTAMPTZ DEFAULT now()`.
- Optional **full-text index** scaffold (commented) for catalogue search.
- Current NWLR defaults: `upper_bound = 2043`, `upper_provisional = FALSE`.

### 6.3 Connect the application
The server uses one small data module (`server/db.js`) plus SQL in
`server/index.js`. To switch to Postgres, the CTO replaces the data layer with a
Postgres client (e.g. `pg`), keeping the **same exported functions and the same
HTTP API**. Concretely:

1. Add a connection pool (`pg.Pool`) reading `DATABASE_URL` (e.g.
   `postgres://user:pass@host:5432/igp_library`). Add `IGP_JWT_SECRET`.
2. Re-implement the row→API mappers (`catalogueToApi`, `memberToApi`,
   `loanToApi`, `settingsToApi`) — trivial, since JSONB/boolean/date come back
   already typed (no `0/1` or JSON-string parsing needed).
3. Re-implement ID generation against `counters` using a transaction:
   ```sql
   BEGIN;
   UPDATE counters SET current = current + 1 WHERE name = 'accession'
     RETURNING current;          -- format as IGP-LIB-{padded}
   INSERT INTO catalogue (...) VALUES (...);
   COMMIT;
   ```
   Use `SELECT ... FOR UPDATE` or the `UPDATE ... RETURNING` shown above so two
   concurrent inserts cannot get the same number.
4. Port the **loan transactions** (issue / return) verbatim into SQL
   transactions — they are the only multi-statement writes:
   - **Issue:** check status is loanable and `copies_available > 0`; decrement
     `copies_available`; set status `On loan` if it hits 0; insert the loan.
   - **Return:** increment `copies_available` (capped at `copies_total`); set
     status `Available` if it was `On loan`; set `date_returned` and status
     `Returned` on the loan.
   - **Overdue** is **computed** (`due_date < today AND date_returned IS NULL`),
     not stored — keep it that way.
5. NWLR endpoints map 1:1 to simple `SELECT/UPDATE` on `nwlr_parts` /
   `nwlr_config`; "raise the upper bound" inserts the new Part rows as `Held`.

The browser needs **no changes** — it only knows the `/api/*` contract.

### 6.4 Migrating existing data
Two options:
- **Re-seed:** point `seedHoldings.js`'s logic at Postgres (same insert rules),
  or run the equivalent inserts; the source spreadsheet + embedded NWLR list are
  the inputs.
- **Copy across:** export the SQLite tables to CSV and `\copy` them into the
  Postgres tables (column names match). Then set the three counters to the
  current max of each ID series so new inserts continue cleanly:
  ```sql
  UPDATE counters SET current = 123  WHERE name = 'accession';  -- max IGP-LIB-*
  UPDATE counters SET current = <n>  WHERE name = 'member';
  UPDATE counters SET current = <n>  WHERE name = 'loan';
  ```

### 6.5 Production checklist
- Set a strong `IGP_JWT_SECRET`; serve over HTTPS.
- Run the API behind a process manager; serve the built `dist/` (same-origin) or
  from a static host with `/api` proxied to the server.
- Schedule database backups (`pg_dump`).
- Roles: keep all data routes `admin`-only until Phase 2; the role check in
  `requireRole(...)` is already structured to add `fc` / `member` scopes.

---

## 7. Reports & exports

All reports export to Excel via SheetJS (`src/lib/excel.js`) and are printable:
catalogue overview, current loans, overdue loans, loan history, acquisitions
log, member directory, and NWLR holdings. The catalogue list has a direct
**Export to Excel**; the NWLR page exports **bands**, the **missing Parts** list,
and the **available (held) Parts** list.

---

## 8. Phase 2 (architected, not built)

Member logins (via `members.linked_auth_uid`), member self-service (own history,
holdings count, catalogue search, "apply for loan" → `loan_requests` → Librarian
approval), and the FC read-only account. Textbook-selection authority is reserved
to the FC by firm policy. Full scope in `ROADMAP.md`. The data model, roles, and
route structure already accommodate these without re-architecting.
