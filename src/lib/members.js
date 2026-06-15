// ============================================================================
// Member (borrower) data access (REST API client).
// In Phase 1, members never log in — the Librarian maintains these records.
// `linkedAuthUid` is reserved for Phase 2 and stays null here.
// ============================================================================

import { api } from './api';

export async function getAllMembers() {
  return api.get('/members');
}

export async function getMember(id) {
  try {
    return await api.get(`/members/${id}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function createMember(data) {
  return api.post('/members', data);
}

export async function updateMember(id, data) {
  return api.put(`/members/${id}`, data);
}
