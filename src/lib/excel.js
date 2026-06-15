// ============================================================================
// SheetJS (xlsx) helpers — import parsing and report export.
// ============================================================================

import * as XLSX from 'xlsx';
import { FIRM_NAME } from './constants';

// --- Import ----------------------------------------------------------------

// Parse an uploaded .xlsx/.csv file into { headers, rows }.
// rows are objects keyed by the sheet's header row.
export async function parseSpreadsheet(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  // Header row as array, then rows as objects.
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const headers = (aoa[0] || []).map((h) => String(h).trim());
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return { headers, rows, sheetName };
}

// --- Export ----------------------------------------------------------------

// Export an array of plain objects to a downloaded .xlsx file.
// `columns` is an array of { key, label }; if omitted, object keys are used.
export function exportToExcel(rows, { filename, sheetName = 'Report', columns } = {}) {
  const cols = columns || inferColumns(rows);
  const aoa = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => normaliseCell(r[c.key]))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(12, String(c.label).length + 2) }));

  const wb = XLSX.utils.book_new();
  // Sheet names are capped at 31 chars by the format.
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = (filename || 'IGP-report').replace(/[^a-z0-9-_]+/gi, '-');
  XLSX.writeFile(wb, `${safe}-${stamp}.xlsx`);
}

function inferColumns(rows) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  return keys.map((k) => ({ key: k, label: k }));
}

function normaliseCell(value) {
  if (Array.isArray(value)) return value.join('; ');
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}

// Firm-name banner string available to any export that wants a title row.
export const EXPORT_BANNER = FIRM_NAME;
