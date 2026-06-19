-- ============================================================================
-- Izy Global Partners LLP — Library Management System
-- SQLite schema (used by the bundled local server for development / testing).
--
-- A matching PostgreSQL schema for production is in db/schema.postgres.sql.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- --- Users (Phase 1: the Librarian, role 'admin'). -------------------------
-- Roles 'fc' and 'member' are reserved for Phase 2 (see ROADMAP.md).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin'
                  CHECK (role IN ('admin', 'fc', 'member')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --- Single settings row (id = 1). -----------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  firm_name           TEXT NOT NULL DEFAULT 'Izy Global Partners LLP',
  loan_period_days    INTEGER NOT NULL DEFAULT 14,
  renewal_length_days INTEGER NOT NULL DEFAULT 14,
  allow_renewals      INTEGER NOT NULL DEFAULT 1
);

-- --- Atomic ID counters (accession / member / loan). -----------------------
CREATE TABLE IF NOT EXISTS counters (
  name    TEXT PRIMARY KEY,         -- 'accession' | 'member' | 'loan'
  current INTEGER NOT NULL DEFAULT 0
);

-- --- Catalogue (one row per bibliographic record). -------------------------
-- Different editions are SEPARATE records; multiple copies of the same edition
-- roll up into one record via copies_total / copies_available.
CREATE TABLE IF NOT EXISTS catalogue (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  accession_number TEXT NOT NULL UNIQUE,           -- IGP-LIB-00001
  title            TEXT NOT NULL,
  authors          TEXT NOT NULL DEFAULT '',       -- may be empty for serials
  publisher        TEXT NOT NULL DEFAULT '',
  edition          TEXT NOT NULL DEFAULT '',
  year             TEXT NOT NULL DEFAULT '',
  isbn             TEXT NOT NULL DEFAULT '',
  issn             TEXT NOT NULL DEFAULT '',
  grouping         TEXT NOT NULL                   -- one of the five firm groupings
                     CHECK (grouping IN (
                       'Textbooks',
                       'Laws / Statutes',
                       'Legal Books / Essays / Commentaries',
                       'Law Reports',
                       'Reference Collections')),
  collection       TEXT NOT NULL DEFAULT 'Izy Global Partners LLP'
                     CHECK (collection IN ('Izy Global Partners LLP')),
  copies_total     INTEGER NOT NULL DEFAULT 1 CHECK (copies_total >= 1),
  copies_available INTEGER NOT NULL DEFAULT 1 CHECK (copies_available >= 0),
  status           TEXT NOT NULL DEFAULT 'Available'
                     CHECK (status IN (
                       'Available', 'On loan', 'Reference only',
                       'Missing', 'Withdrawn')),
  firm_authorship  INTEGER NOT NULL DEFAULT 0,     -- boolean (FC-authored works)
  keywords         TEXT NOT NULL DEFAULT '[]',     -- JSON array of strings
  shelf_location   TEXT NOT NULL DEFAULT '',
  acquisition_date TEXT,                           -- ISO date or NULL
  volume           TEXT NOT NULL DEFAULT '',       -- serials (e.g. NWLR)
  part             TEXT NOT NULL DEFAULT '',       -- serials (e.g. NWLR Part)
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_catalogue_grouping   ON catalogue (grouping);
CREATE INDEX IF NOT EXISTS idx_catalogue_collection ON catalogue (collection);
CREATE INDEX IF NOT EXISTS idx_catalogue_status     ON catalogue (status);

-- --- Members (borrowers; no logins in Phase 1). ----------------------------
CREATE TABLE IF NOT EXISTS members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id       TEXT NOT NULL UNIQUE,            -- IGP-MEM-0001
  full_name       TEXT NOT NULL,
  member_type     TEXT NOT NULL DEFAULT 'Other'
                    CHECK (member_type IN (
                      'Founder/Chairman', 'Partner', 'Associate',
                      'Staff', 'External', 'Other')),
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  date_added      TEXT,
  status          TEXT NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Inactive')),
  notes           TEXT NOT NULL DEFAULT '',
  linked_auth_uid TEXT,                            -- Phase 2 placeholder (NULL now)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --- Loans (one row per loan event; display fields denormalised). ----------
CREATE TABLE IF NOT EXISTS loans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id          TEXT NOT NULL UNIQUE,           -- IGP-LOAN-00001
  accession_number TEXT NOT NULL,
  book_title       TEXT NOT NULL,
  member_id        TEXT NOT NULL,
  member_name      TEXT NOT NULL,
  date_issued      TEXT NOT NULL,
  due_date         TEXT NOT NULL,
  date_returned    TEXT,                           -- NULL while on loan
  status           TEXT NOT NULL DEFAULT 'On loan' -- Overdue is computed
                    CHECK (status IN ('On loan', 'Returned', 'Overdue')),
  renewed_count    INTEGER NOT NULL DEFAULT 0,
  issued_by        TEXT NOT NULL DEFAULT 'admin',
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loans_member  ON loans (member_id);
CREATE INDEX IF NOT EXISTS idx_loans_book    ON loans (accession_number);
CREATE INDEX IF NOT EXISTS idx_loans_open    ON loans (date_returned);

-- --- NWLR serial run (Nigerian Weekly Law Reports). ------------------------
-- NWLR is held as ONE catalogue record (a serial). Its individual Parts are
-- tracked here as Held / Missing so the app always knows which Parts are held
-- without inflating the catalogue title/copy counts.
CREATE TABLE IF NOT EXISTS nwlr_parts (
  part_no INTEGER PRIMARY KEY,
  status  TEXT NOT NULL DEFAULT 'Missing' CHECK (status IN ('Held', 'Missing'))
);

CREATE TABLE IF NOT EXISTS nwlr_config (
  id                SMALLINT PRIMARY KEY CHECK (id = 1),
  upper_bound       INTEGER NOT NULL DEFAULT 2043,  -- run currently held through Part 2043
  upper_provisional INTEGER NOT NULL DEFAULT 0,     -- boolean: 0 = confirmed by the firm
  serial_accession  TEXT                            -- accession of the NWLR catalogue record
);

-- --- Law report series -----------------------------------------------------
-- A law report is a serial (one catalogue record). Each series is tracked by
-- one of two models:
--   * kind = 'parts'   — Part-by-Part held/missing (e.g. NWLR, via nwlr_parts).
--   * kind = 'volumes' — a list of held volumes (e.g. LRECN, via
--                        law_report_volumes below).
-- Every series can carry searchable index entries (law_report_indexes).
CREATE TABLE IF NOT EXISTS law_report_series (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  abbreviation     TEXT NOT NULL UNIQUE,            -- e.g. 'NWLR', 'LRECN'
  name             TEXT NOT NULL,                   -- full title
  kind             TEXT NOT NULL DEFAULT 'volumes'
                     CHECK (kind IN ('parts', 'volumes')),
  serial_accession TEXT,                            -- catalogue record (IGP-LIB-...)
  description      TEXT NOT NULL DEFAULT '',
  sort_order       INTEGER NOT NULL DEFAULT 100,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Held / missing volumes for 'volumes'-kind series.
CREATE TABLE IF NOT EXISTS law_report_volumes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id  INTEGER NOT NULL REFERENCES law_report_series (id),
  label      TEXT NOT NULL,                          -- e.g. '1992 — LRECN 1'
  year       TEXT NOT NULL DEFAULT '',
  volume     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'Held' CHECK (status IN ('Held', 'Missing')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_lrv_series ON law_report_volumes (series_id);

-- Searchable index entries for any series (subject / case / digest indexes).
CREATE TABLE IF NOT EXISTS law_report_indexes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id  INTEGER NOT NULL REFERENCES law_report_series (id),
  title      TEXT NOT NULL,                          -- index entry / heading
  reference  TEXT NOT NULL DEFAULT '',               -- where it points (vol/part/page)
  keywords   TEXT NOT NULL DEFAULT '',               -- free-text retrieval tags
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lri_series ON law_report_indexes (series_id);

-- --- Loan requests (PHASE 2 SCAFFOLD — not used in Phase 1). ---------------
CREATE TABLE IF NOT EXISTS loan_requests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id        TEXT NOT NULL,
  member_auth_uid  TEXT,
  accession_number TEXT NOT NULL,
  book_title       TEXT NOT NULL,
  requested_at     TEXT NOT NULL DEFAULT (datetime('now')),
  status           TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending', 'Approved', 'Declined'))
);
