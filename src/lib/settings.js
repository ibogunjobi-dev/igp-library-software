// ============================================================================
// Settings access (REST API client). Single configuration record on the server.
// ============================================================================

import { api } from './api';

export async function getSettings() {
  return api.get('/settings');
}

export async function saveSettings(patch) {
  return api.put('/settings', patch);
}
