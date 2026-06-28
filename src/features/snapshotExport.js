/**
 * snapshotExport.js
 * Bounty feature: "Snapshot Export" — exports the *currently visible*
 * dataset (after multi-column sort + filters/search are applied) to a
 * downloadable .csv file. Entirely client-side: no network request, no
 * server round-trip — just Sorter + FilterEngine output serialized into a
 * Blob and downloaded via a throwaway <a download> link.
 *
 * Non-blocking by design: with up to ~50k rows, building one giant CSV
 * string synchronously would tie up the main thread for a noticeable
 * stutter (dropped stream frames, janky scroll). Instead we build the CSV
 * in row-chunks across multiple macrotasks (setTimeout 0 between chunks),
 * yielding back to the event loop so the 200ms telemetry tick, virtual
 * grid scroll, and UI stay responsive throughout. The stream is NOT
 * paused for this — export runs against a single consistent snapshot of
 * the data taken at click time, but background ingestion keeps going.
 */

import { TickerStore }  from '../state/store.js';
import { FilterEngine } from '../grid/filterEngine.js';
import { Sorter }       from '../grid/sorter.js';

const CHUNK_SIZE = 2000; // rows per macrotask slice — tune for responsiveness vs. speed

// Column order + headers for the export. Kept explicit (rather than
// Object.keys(row)) so the CSV has a stable, predictable schema even if
// internal fields are added later.
const EXPORT_COLUMNS = [
  { key: 'project_id',           header: 'Project ID' },
  { key: 'project_name',         header: 'Project Name' },
  { key: 'company_id',           header: 'Company ID' },
  { key: 'project_status',       header: 'Status' },
  { key: 'automation_type',      header: 'Asset Class' },
  { key: 'industry',             header: 'Sector' },
  { key: 'country',              header: 'Exchange Region' },
  { key: 'department',           header: 'Department' },
  { key: 'budget_usd',           header: 'Budget (USD)' },
  { key: 'annual_savings_usd',   header: 'Annual Savings (USD)' },
  { key: 'roi_percent',          header: 'ROI (%)' },
  { key: 'robots_deployed',      header: 'Units Deployed' },
  { key: 'employee_hours_saved', header: 'Employee Hours Saved' },
  { key: 'implementation_partner', header: 'Implementation Partner' },
  { key: 'ai_enabled',           header: 'AI Enabled' },
  { key: 'cloud_deployment',     header: 'Cloud Deployment' },
  { key: 'start_date',           header: 'Start Date' },
  { key: 'completion_date',      header: 'Completion Date' },
];

/** Escape a single CSV field per RFC 4180 (quote if it contains a comma, quote, or newline). */
function _csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function _rowToCSVLine(row) {
  return EXPORT_COLUMNS.map(c => _csvEscape(row[c.key])).join(',');
}

/** Yield to the event loop between chunks so the stream/UI never freezes. */
function _nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function _buildCSV(rows, onProgress) {
  const lines = [EXPORT_COLUMNS.map(c => _csvEscape(c.header)).join(',')];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    for (const row of chunk) lines.push(_rowToCSVLine(row));
    if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, rows.length), rows.length);
    await _nextTick(); // give the stream tick / scroll / paint a chance to run
  }

  return lines.join('\r\n');
}

function _triggerDownload(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke shortly after — must outlive the click-triggered download start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _timestampedFilename() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `tickerfloor_snapshot_${stamp}.csv`;
}

let _btnEl = null;
let _busy  = false;

export const SnapshotExport = {
  mount(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <button id="snapshot-export-btn" class="snapshot-export-btn" title="Export the current sorted/filtered view as CSV">
        <span class="snapshot-icon">⤓</span> Snapshot Export
      </button>`;
    _btnEl = document.getElementById('snapshot-export-btn');
    _btnEl.addEventListener('click', () => SnapshotExport.run());
  },

  async run() {
    if (_busy || !_btnEl) return;
    _busy = true;

    const originalLabel = _btnEl.innerHTML;
    _btnEl.disabled = true;

    try {
      // Snapshot the data *now* — a consistent point-in-time view, matching
      // exactly what's on screen: filtered, then sorted, same as the grid.
      const allRows      = TickerStore.getAllRows();
      const filteredRows = FilterEngine.filter(allRows);
      const sortedRows    = Sorter.sort(filteredRows);

      if (sortedRows.length === 0) {
        _btnEl.innerHTML = 'No rows to export';
        setTimeout(() => { _btnEl.innerHTML = originalLabel; }, 1800);
        return;
      }

      const csvText = await _buildCSV(sortedRows, (done, total) => {
        _btnEl.innerHTML = `<span class="snapshot-icon">⤓</span> Exporting… ${Math.round((done / total) * 100)}%`;
      });

      _triggerDownload(csvText, _timestampedFilename());

      _btnEl.innerHTML = `<span class="snapshot-icon">✓</span> Exported ${sortedRows.length.toLocaleString()} rows`;
      setTimeout(() => { _btnEl.innerHTML = originalLabel; }, 2200);
    } catch (err) {
      console.error('[snapshotExport] export failed:', err);
      _btnEl.innerHTML = `<span class="snapshot-icon">⚠</span> Export failed`;
      setTimeout(() => { _btnEl.innerHTML = originalLabel; }, 2200);
    } finally {
      _btnEl.disabled = false;
      _busy = false;
    }
  },
};
