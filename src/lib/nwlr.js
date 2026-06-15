// ============================================================================
// NWLR (Nigerian Weekly Law Reports) holdings — API client.
//
// NWLR is one serial catalogue record; its individual Parts are tracked as
// Held / Missing. "Available Parts" = every Held Part in [1, upper bound];
// the server computes this — it is never typed by hand.
// ============================================================================

import { api } from './api';

export async function getNwlrStatus() {
  return api.get('/nwlr/status');
}

// Full Parts list within the run; pass 'Held' or 'Missing' to filter.
export async function getNwlrParts(status) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get(`/nwlr/parts${q}`);
}

export async function lookupNwlrPart(n) {
  return api.get(`/nwlr/part/${n}`);
}

// Flip a Part Missing -> Held (when later acquired).
export async function markNwlrPartHeld(n) {
  return api.post(`/nwlr/part/${n}/hold`);
}

export async function setNwlrUpperBound(upperBound, upperProvisional = true) {
  return api.put('/nwlr/upper-bound', { upperBound, upperProvisional });
}
