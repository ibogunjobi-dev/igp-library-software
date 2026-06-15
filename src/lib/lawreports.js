// ============================================================================
// Law reports — API client.
//
// A law report series is either Part-based ('parts', e.g. NWLR) or volume-based
// ('volumes', e.g. LRECN). Every series carries searchable index entries.
// ============================================================================

import { api } from './api';

export async function getLawReportSeriesList() {
  return api.get('/law-reports');
}

export async function getLawReportSeries(id) {
  return api.get(`/law-reports/${id}`);
}

export async function createLawReportSeries(data) {
  return api.post('/law-reports', data);
}

// Index entries (subject / case / digest indexes) for a series.
export async function searchSeriesIndexes(id, q) {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  return api.get(`/law-reports/${id}/indexes${query}`);
}

export async function addSeriesIndex(id, data) {
  return api.post(`/law-reports/${id}/indexes`, data);
}

// Volumes (for volume-based series).
export async function addSeriesVolume(id, data) {
  return api.post(`/law-reports/${id}/volumes`, data);
}

export async function setVolumeStatus(volumeId, status) {
  return api.patch(`/law-reports/volumes/${volumeId}`, { status });
}
