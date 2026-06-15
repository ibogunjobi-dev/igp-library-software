// ============================================================================
// Formatting helpers — dates, document references, display utilities.
// UK / Nigerian English conventions throughout.
// ============================================================================

import { DOC_REF_PREFIX } from './constants';

// Convert a Firestore Timestamp | Date | ISO string | null to a JS Date | null.
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate(); // Firestore Timestamp
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Display a date as DD MMM YYYY (e.g. 14 Jun 2026).
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ISO yyyy-mm-dd, suitable for <input type="date"> values.
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// Days difference (target - today), floored to whole days. Negative = overdue.
export function daysUntil(value) {
  const d = toDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Add days to a date and return a new Date.
export function addDays(value, days) {
  const d = toDate(value) || new Date();
  const result = new Date(d);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

// Build a firm document reference: "IGP / <value>" — never inserts "IOI".
export function docRef(value) {
  return `${DOC_REF_PREFIX}${value ?? '______'}`;
}

// Normalise an authors field (string | array) to a display string.
export function authorsToDisplay(authors) {
  if (Array.isArray(authors)) return authors.filter(Boolean).join('; ');
  return authors || '';
}

// Lower-cased, trimmed string for case-insensitive comparison.
export function norm(value) {
  return String(value ?? '').trim().toLowerCase();
}
