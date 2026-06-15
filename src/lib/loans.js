// ============================================================================
// Loan data access and lifecycle (REST API client).
//
// Issue / return / renew are transactional on the server, which keeps each
// catalogue record's copiesAvailable correct (never negative, never over total)
// and denormalises the book title and member name onto the loan for fast lists.
// Overdue is a computed display status (due date passed, not yet returned).
// ============================================================================

import { api } from './api';
import { daysUntil } from './format';

export async function getAllLoans() {
  const loans = await api.get('/loans');
  return loans.map(withComputedStatus);
}

export async function getLoansForMember(memberId) {
  const loans = await getAllLoans();
  return loans
    .filter((l) => l.memberId === memberId)
    .sort((a, b) => String(b.dateIssued).localeCompare(String(a.dateIssued)));
}

// Compute the display status: an unreturned loan past its due date is Overdue.
export function withComputedStatus(loan) {
  if (loan.dateReturned) return { ...loan, status: 'Returned' };
  const days = daysUntil(loan.dueDate);
  if (days != null && days < 0) return { ...loan, status: 'Overdue' };
  return { ...loan, status: 'On loan' };
}

export function isOverdue(loan) {
  return !loan.dateReturned && daysUntil(loan.dueDate) < 0;
}

// Issue a loan. Availability and reference-only checks are enforced server-side.
export async function issueLoan({ book, member, dueDate, notes }) {
  return api.post('/loans', {
    bookId: book.id,
    memberId: member.id,
    dueDate: dueDate || undefined,
    notes,
  });
}

export async function returnLoan(loan) {
  return api.post(`/loans/${loan.id}/return`);
}

export async function renewLoan(loan) {
  return api.post(`/loans/${loan.id}/renew`);
}
