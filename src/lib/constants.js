// ============================================================================
// Firm-wide constants and controlled vocabularies.
// These are the ONLY permitted values; do not invent others (see spec).
// ============================================================================

// The firm name must render EXACTLY like this everywhere (never "IZY ...").
export const FIRM_NAME = 'Izy Global Partners LLP';
export const FIRM_SUBLINE = 'Legal & Knowledge Resources Centre';

// The five firm groupings — use exactly these, in this order.
export const GROUPINGS = [
  'Textbooks',
  'Laws / Statutes',
  'Legal Books / Essays / Commentaries',
  'Law Reports',
  'Reference Collections',
];

// Collections the firm maintains (default new entries to the firm itself).
export const COLLECTIONS = [
  'Izy Global Partners LLP',
  'Alex. A. Izinyon & Co.',
];
export const DEFAULT_COLLECTION = 'Izy Global Partners LLP';

// Catalogue record status.
export const CATALOGUE_STATUSES = [
  'Available',
  'On loan',
  'Reference only',
  'Missing',
  'Withdrawn',
];

// Statuses from which a copy may NOT be loaned out.
export const NON_LOANABLE_STATUSES = ['Reference only', 'Missing', 'Withdrawn'];

// Member types.
export const MEMBER_TYPES = [
  'Founder/Chairman',
  'Partner',
  'Associate',
  'Staff',
  'External',
  'Other',
];

export const MEMBER_STATUSES = ['Active', 'Inactive'];

// Loan status (Overdue is computed, not stored as a hard state).
export const LOAN_STATUSES = ['On loan', 'Returned', 'Overdue'];

// Roles. Phase 1 uses 'admin' only; the others are scaffolded for Phase 2.
export const ROLES = {
  ADMIN: 'admin',
  FC: 'fc', // Phase 2 — read-only Founder/Chairman
  MEMBER: 'member', // Phase 2 — borrower self-service
};

// The FC's two authored titles — pre-tagged firmAuthorship on import.
export const FIRM_AUTHORED_TITLES = [
  'Modern Nigerian Law of Contract',
  'Through the Cases',
];

// ID formats.
export const ACCESSION_PREFIX = 'IGP-LIB-';
export const ACCESSION_PAD = 5; // IGP-LIB-00001
export const MEMBER_PREFIX = 'IGP-MEM-';
export const MEMBER_PAD = 4; // IGP-MEM-0001
export const LOAN_PREFIX = 'IGP-LOAN-';
export const LOAN_PAD = 5; // IGP-LOAN-00001

// Default settings (seeded on first run if no settings document exists).
export const DEFAULT_SETTINGS = {
  firmName: FIRM_NAME,
  loanPeriodDays: 14,
  renewalLengthDays: 14,
  allowRenewals: true,
};

// Document-reference helper format. Generates "IGP / <value>" — never "IOI".
export const DOC_REF_PREFIX = 'IGP / ';
