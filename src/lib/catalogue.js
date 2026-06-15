// ============================================================================
// Catalogue data access (REST API client).
//
// Firm policy enforced across the system:
//  - Different editions are SEPARATE records (edition is part of identity).
//  - Multiple copies of the SAME edition roll up into one record's copy count.
//  - Accession numbers are generated server-side and never reused.
//
// Duplicate detection (title + author + edition + publisher) is a pure helper
// used by the add form and the importer before a create call is made.
// ============================================================================

import { api } from './api';
import { norm } from './format';

export async function getAllCatalogue() {
  return api.get('/catalogue');
}

export async function getCatalogueItem(id) {
  try {
    return await api.get(`/catalogue/${id}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Create a new catalogue record. The server generates the accession number
// unless `preserveAccession` is supplied (used by the importer).
export async function createCatalogueItem(data, { preserveAccession = null } = {}) {
  return api.post('/catalogue', { ...data, accessionNumber: preserveAccession || undefined });
}

export async function updateCatalogueItem(id, data) {
  return api.put(`/catalogue/${id}`, data);
}

// Increment the copy count on an existing record (duplicate roll-up).
export async function incrementCopies(id, by = 1) {
  return api.post(`/catalogue/${id}/copies`, { by });
}

// Status change (withdraw / mark missing / restore) without hard deletion.
export async function setCatalogueStatus(id, status) {
  return api.patch(`/catalogue/${id}/status`, { status });
}

// --- Duplicate detection (pure) --------------------------------------------
// A "same edition" duplicate matches on title + author + edition + publisher
// (case-insensitive). Returns the matching record, or null.
export function findDuplicate(records, candidate) {
  const key = duplicateKey(candidate);
  return records.find((r) => duplicateKey(r) === key) || null;
}

function duplicateKey(r) {
  const authors = Array.isArray(r.authors) ? r.authors.join('; ') : r.authors;
  return [norm(r.title), norm(authors), norm(r.edition), norm(r.publisher)].join('||');
}
