# Roadmap — Izy Global Partners LLP, Library Management System

Phase 1 (the single-operator **Librarian** console) is built. This document
records **Phase 2**, which is *architected for but deliberately not built*. The
data model, roles, security-rule scaffolding and route structure are already in
place so Phase 2 can be added without re-architecting.

---

## Phase 1 — built (single operator: the Librarian)

The Librarian is the only person who logs in and performs all operations:

- Authentication (Firebase Auth, email/password; no public sign-up).
- Cataloguing: add / edit / view / withdraw / mark-missing records; auto
  accession numbering (`IGP-LIB-NNNNN`); same-edition duplicate roll-up.
- Members: add/edit borrowers as member records (no member logins yet).
- Loans: issue / return / renew; overdue computation; loan register with filters.
- Search & filter across the catalogue.
- Spreadsheet import (SheetJS) with user-driven column mapping.
- Dashboard and exportable/printable reports.
- Settings (loan period, renewal length, toggles).

---

## Phase 2 — architected, NOT built

### 1. Member logins
- Members receive accounts and can log in.
- Linkage point already exists: `members.linked_auth_uid` / `linkedAuthUid`
  (nullable, unused in Phase 1). Phase 2 sets this to the member's user id.
- Role `member` is already defined (`src/lib/constants.js → ROLES.MEMBER`),
  present in the `users.role` enum (both SQLite and Postgres schemas), and
  scaffolded in the server's role check and the route guard.

### 2. Member self-service
A logged-in member can:
- view their own current loans and full borrowing history;
- see how many books they currently hold;
- search the catalogue;
- submit a **loan request** ("apply for loan").

Loan-request flow:
- Table **`loan_requests`** is already in both schemas
  (`server/schema.sqlite.sql`, `db/schema.postgres.sql`):
  `{ member_id, member_auth_uid, accession_number, book_title, requested_at, status }`
  with status `Pending | Approved | Declined`.
- The member creates a request; the **Librarian approves**, which converts it
  into a `loans` record using the existing loan-issue logic
  (`POST /api/loans`).
- Route stub: `/member/*` (`src/pages/phase2/MemberPortalStub.jsx`).

### 3. Founder/Chairman (FC) read-only account
- Role `fc` (`ROLES.FC`), read-only.
- Scope: dashboards, reports, catalogue search, and holdings status. **No
  editing of any record.**
- Route stub: `/fc/*` (`src/pages/phase2/FcDashboardStub.jsx`).
- **Confirm with the FC** which reports appear on the read-only dashboard. The
  Phase 1 default builds all seven (catalogue overview; current loans; overdue
  loans; loan history; acquisitions log; member directory; NWLR holdings status).

### Firm policy note — textbook-selection authority
Textbook-selection authority is **reserved to the Founder/Chairman** as a matter
of firm policy. No system enforcement is required now; this note records the
policy so that, if Phase 2 ever adds acquisition/selection workflows, the
approval step for the *Textbooks* grouping is routed to the FC.

---

## What is already in place for Phase 2

| Concern        | Phase 1 state (ready for Phase 2)                                  |
|----------------|---------------------------------------------------------------------|
| Roles          | `admin`, `fc`, `member` defined and present in the `users.role` enum; only `admin` active. |
| Member linkage | `members.linked_auth_uid` reserved (null in Phase 1).             |
| Schema         | `loan_requests` table present in both SQLite and Postgres schemas; inert. |
| Access control | Server uses a role-based check (`requireRole(...)`); Phase 1 routes require `admin`. New `fc`/`member` routes attach the same check with different roles. |
| Routes         | `/member/*` and `/fc/*` mounted as stubs behind the route guard.  |
| Route guard    | `ProtectedRoute` accepts an `allow` role list — flip to `[ROLES.FC]` etc. |
| Loan issuing   | `POST /api/loans` is reusable by an approved-loan-request handler. |

### To switch a feature on in Phase 2
1. Add the `fc` / `member` data routes on the server with the appropriate
   `requireRole(...)` check, and the `loan_requests` endpoints.
2. Build the member/FC pages and replace the stub components.
3. Change the stub routes' `allow` prop from `[ROLES.ADMIN]` to the intended
   role(s) (e.g. `[ROLES.MEMBER]`, `[ROLES.FC]`).
4. Assign roles by setting `users.role` for the relevant accounts.
