-- ============================================================================
-- Izy Global Partners LLP — Library Management System
-- PostgreSQL schema (PRODUCTION TARGET — for the CTO to implement).
--
-- This mirrors the SQLite schema used by the bundled local/testing server
-- (server/schema.sqlite.sql). It is the intended production data model.
--
-- Notes for implementation:
--   * Identifier sequences (accession / member / loan) are kept in the
--     `counters` table so the application can format human-readable IDs
--     (IGP-LIB-00001, IGP-MEM-0001, IGP-LOAN-00001). Increment them inside the
--     same transaction as the insert (SELECT ... FOR UPDATE) so numbers never
--     collide or get reused. Native sequences could be used instead if the
--     formatted-ID generation is handled in application code.
--   * Roles 'fc' and 'member' and the `loan_requests` table are Phase 2
--     scaffolding — present in the model, inert in Phase 1 (see ROADMAP.md).
--   * `members.linked_auth_uid` is a Phase 2 placeholder (NULL in Phase 1).
-- ============================================================================

-- --- Enumerated types ------------------------------------------------------
CREATE TYPE user_role          AS ENUM ('admin', 'fc', 'member');
CREATE TYPE catalogue_grouping AS ENUM (
  'Textbooks',
  'Laws / Statutes',
  'Legal Books / Essays / Commentaries',
  'Law Reports',
  'Reference Collections'
);
CREATE TYPE catalogue_collection AS ENUM (
  'Izy Global Partners LLP',
  'Alex. A. Izinyon & Co.'
);
CREATE TYPE catalogue_status AS ENUM (
  'Available', 'On loan', 'Reference only', 'Missing', 'Withdrawn'
);
CREATE TYPE member_type   AS ENUM (
  'Founder/Chairman', 'Partner', 'Associate', 'Staff', 'External', 'Other'
);
CREATE TYPE member_status AS ENUM ('Active', 'Inactive');
CREATE TYPE loan_status   AS ENUM ('On loan', 'Returned', 'Overdue');
CREATE TYPE loan_request_status AS ENUM ('Pending', 'Approved', 'Declined');

-- --- Users -----------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Settings (single row enforced by a fixed primary key) -----------------
CREATE TABLE settings (
  id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  firm_name           TEXT NOT NULL DEFAULT 'Izy Global Partners LLP',
  loan_period_days    INTEGER NOT NULL DEFAULT 14,
  renewal_length_days INTEGER NOT NULL DEFAULT 14,
  allow_renewals      BOOLEAN NOT NULL DEFAULT TRUE
);

-- --- Identifier counters ---------------------------------------------------
CREATE TABLE counters (
  name    TEXT PRIMARY KEY,          -- 'accession' | 'member' | 'loan'
  current INTEGER NOT NULL DEFAULT 0
);

-- --- Catalogue -------------------------------------------------------------
CREATE TABLE catalogue (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accession_number TEXT NOT NULL UNIQUE,            -- IGP-LIB-00001
  title            TEXT NOT NULL,
  authors          TEXT NOT NULL DEFAULT '',        -- may be empty for serials
  publisher        TEXT NOT NULL DEFAULT '',
  edition          TEXT NOT NULL DEFAULT '',
  year             TEXT NOT NULL DEFAULT '',
  isbn             TEXT NOT NULL DEFAULT '',
  issn             TEXT NOT NULL DEFAULT '',
  grouping         catalogue_grouping NOT NULL,
  collection       catalogue_collection NOT NULL DEFAULT 'Izy Global Partners LLP',
  copies_total     INTEGER NOT NULL DEFAULT 1 CHECK (copies_total >= 1),
  copies_available INTEGER NOT NULL DEFAULT 1 CHECK (copies_available >= 0),
  status           catalogue_status NOT NULL DEFAULT 'Available',
  firm_authorship  BOOLEAN NOT NULL DEFAULT FALSE,  -- FC-authored works
  keywords         JSONB NOT NULL DEFAULT '[]'::jsonb,
  shelf_location   TEXT NOT NULL DEFAULT '',
  acquisition_date DATE,
  volume           TEXT NOT NULL DEFAULT '',        -- serials (e.g. NWLR)
  part             TEXT NOT NULL DEFAULT '',        -- serials (e.g. NWLR Part)
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT copies_available_le_total CHECK (copies_available <= copies_total)
);

CREATE INDEX idx_catalogue_grouping   ON catalogue (grouping);
CREATE INDEX idx_catalogue_collection ON catalogue (collection);
CREATE INDEX idx_catalogue_status     ON catalogue (status);
-- Optional full-text search support for title/author/publisher/keywords:
-- CREATE INDEX idx_catalogue_fts ON catalogue
--   USING gin (to_tsvector('english',
--     title || ' ' || authors || ' ' || publisher || ' ' || keywords::text));

-- --- Members ---------------------------------------------------------------
CREATE TABLE members (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id       TEXT NOT NULL UNIQUE,             -- IGP-MEM-0001
  full_name       TEXT NOT NULL,
  member_type     member_type NOT NULL DEFAULT 'Other',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  date_added      DATE,
  status          member_status NOT NULL DEFAULT 'Active',
  notes           TEXT NOT NULL DEFAULT '',
  linked_auth_uid TEXT,                             -- Phase 2 placeholder (NULL now)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Loans -----------------------------------------------------------------
CREATE TABLE loans (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id          TEXT NOT NULL UNIQUE,            -- IGP-LOAN-00001
  accession_number TEXT NOT NULL REFERENCES catalogue (accession_number),
  book_title       TEXT NOT NULL,                   -- denormalised for fast lists
  member_id        TEXT NOT NULL REFERENCES members (member_id),
  member_name      TEXT NOT NULL,                   -- denormalised
  date_issued      DATE NOT NULL,
  due_date         DATE NOT NULL,
  date_returned    DATE,                            -- NULL while on loan
  status           loan_status NOT NULL DEFAULT 'On loan',
  renewed_count    INTEGER NOT NULL DEFAULT 0,
  issued_by        TEXT NOT NULL DEFAULT 'admin',
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loans_member ON loans (member_id);
CREATE INDEX idx_loans_book   ON loans (accession_number);
CREATE INDEX idx_loans_open   ON loans (date_returned);

-- --- NWLR serial run (Nigerian Weekly Law Reports) -------------------------
-- NWLR is held as ONE catalogue record (a serial). Its individual Parts are
-- tracked here as Held / Missing so the app always knows which Parts are held
-- without inflating the catalogue title/copy counts.
CREATE TYPE nwlr_part_status AS ENUM ('Held', 'Missing');

CREATE TABLE nwlr_parts (
  part_no INTEGER PRIMARY KEY,
  status  nwlr_part_status NOT NULL DEFAULT 'Missing'
);

CREATE TABLE nwlr_config (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  upper_bound       INTEGER NOT NULL DEFAULT 2043,    -- run currently held through Part 2043
  upper_provisional BOOLEAN NOT NULL DEFAULT FALSE,   -- FALSE = bound confirmed by the firm
  serial_accession  TEXT REFERENCES catalogue (accession_number)
);

-- --- Law report series -----------------------------------------------------
-- A law report is a serial (one catalogue record). kind = 'parts' tracks
-- Part-by-Part (NWLR, via nwlr_parts); kind = 'volumes' tracks a held-volume
-- list (LRECN, via law_report_volumes). Every series may carry searchable
-- index entries (law_report_indexes).
CREATE TYPE law_report_kind          AS ENUM ('parts', 'volumes');
CREATE TYPE law_report_volume_status AS ENUM ('Held', 'Missing');

CREATE TABLE law_report_series (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  abbreviation     TEXT NOT NULL UNIQUE,            -- e.g. 'NWLR', 'LRECN'
  name             TEXT NOT NULL,
  kind             law_report_kind NOT NULL DEFAULT 'volumes',
  serial_accession TEXT REFERENCES catalogue (accession_number),
  description      TEXT NOT NULL DEFAULT '',
  sort_order       INTEGER NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE law_report_volumes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  series_id  BIGINT NOT NULL REFERENCES law_report_series (id),
  label      TEXT NOT NULL,
  year       TEXT NOT NULL DEFAULT '',
  volume     TEXT NOT NULL DEFAULT '',
  status     law_report_volume_status NOT NULL DEFAULT 'Held',
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_lrv_series ON law_report_volumes (series_id);

CREATE TABLE law_report_indexes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  series_id  BIGINT NOT NULL REFERENCES law_report_series (id),
  title      TEXT NOT NULL,
  reference  TEXT NOT NULL DEFAULT '',
  keywords   TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lri_series ON law_report_indexes (series_id);
-- Optional full-text index for index search:
-- CREATE INDEX idx_lri_fts ON law_report_indexes
--   USING gin (to_tsvector('english', title || ' ' || reference || ' ' || keywords));

-- --- Loan requests (PHASE 2 SCAFFOLD — not used in Phase 1) -----------------
CREATE TABLE loan_requests (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id        TEXT NOT NULL REFERENCES members (member_id),
  member_auth_uid  TEXT,
  accession_number TEXT NOT NULL REFERENCES catalogue (accession_number),
  book_title       TEXT NOT NULL,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           loan_request_status NOT NULL DEFAULT 'Pending'
);

-- --- Seed rows -------------------------------------------------------------
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO counters (name, current) VALUES
  ('accession', 0), ('member', 0), ('loan', 0)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO nwlr_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
