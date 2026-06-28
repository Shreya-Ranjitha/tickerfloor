/**
 * rowInspector.js
 * Bounty feature: when the market is halted (paused), clicking any row in the
 * virtualized grid opens an isolated inspector panel that parses and displays
 * every relational attribute of that project — grouped into logical sections
 * rather than a flat dump, with the same number formatting used elsewhere.
 *
 * Why gated on pause: the underlying row object is being mutated by the
 * stream every ~200ms. Inspecting a live-mutating object inline would be
 * confusing (numbers changing under the user's cursor), so the inspector is
 * only reachable while the feed is halted — the row is guaranteed stable for
 * the duration the panel is open.
 */

import { formatUSD, formatPct, formatInt, formatHours } from './sanitize.js';

let _overlayEl = null;
let _panelEl   = null;
let _openId    = null;

// Friendly labels + per-field formatting/grouping, so the dump reads like a
// proper inspector rather than a raw object printout.
const SECTIONS = [
  {
    title: 'Identity',
    fields: [
      { key: 'project_id',   label: 'Ticker / Project ID' },
      { key: 'project_name', label: 'Security Name' },
      { key: 'company_id',  label: 'Company ID' },
    ],
  },
  {
    title: 'Status',
    fields: [
      { key: 'project_status', label: 'Status', render: v => v || '—' },
      { key: 'automation_type', label: 'Asset Class' },
      { key: 'ai_enabled',      label: 'AI-Enabled' },
      { key: 'cloud_deployment',label: 'Cloud Deployment' },
    ],
  },
  {
    title: 'Financials',
    fields: [
      { key: 'budget_usd',         label: 'Budget',         render: formatUSD },
      { key: 'annual_savings_usd', label: 'Annual Savings', render: formatUSD },
      { key: 'roi_percent',        label: 'ROI / Yield',    render: formatPct },
    ],
  },
  {
    title: 'Operations',
    fields: [
      { key: 'robots_deployed',      label: 'Units Deployed',      render: formatInt },
      { key: 'employee_hours_saved', label: 'Employee Hours Saved', render: formatHours },
      { key: 'implementation_partner', label: 'Implementation Partner' },
    ],
  },
  {
    title: 'Classification',
    fields: [
      { key: 'industry', label: 'Sector' },
      { key: 'country',  label: 'Exchange Region' },
      { key: 'department', label: 'Department' },
    ],
  },
  {
    title: 'Timeline',
    fields: [
      { key: 'start_date',      label: 'Start Date' },
      { key: 'completion_date', label: 'Completion Date', render: v => v || '— (ongoing)' },
    ],
  },
];

// Fields already shown above, in a known field — used to surface anything
// the CSV adds later (forward-compatible) under a final "Other" section.
const KNOWN_KEYS = new Set(SECTIONS.flatMap(s => s.fields.map(f => f.key)));

function _humanizeKey(key) {
  return key.replace(/_/g, ' ').replace(/\busd\b/i, 'USD').replace(/\b\w/g, c => c.toUpperCase());
}

function _renderValue(val) {
  if (val === null || val === undefined || val === '') return '<span class="inspector-empty">—</span>';
  return String(val);
}

function _buildSectionsHTML(row) {
  let html = '';

  for (const section of SECTIONS) {
    const rows = section.fields
      .filter(f => row[f.key] !== undefined)
      .map(f => {
        const raw = row[f.key];
        const display = f.render ? f.render(raw) : _renderValue(raw);
        return `
          <div class="inspector-field">
            <div class="inspector-field-label">${f.label}</div>
            <div class="inspector-field-value">${display}</div>
          </div>`;
      })
      .join('');

    if (rows) {
      html += `
        <div class="inspector-section">
          <div class="inspector-section-title">${section.title}</div>
          <div class="inspector-section-grid">${rows}</div>
        </div>`;
    }
  }

  // Anything in the raw row not covered above — forward-compatible catch-all.
  const extraKeys = Object.keys(row).filter(k => !KNOWN_KEYS.has(k));
  if (extraKeys.length) {
    const rows = extraKeys.map(k => `
      <div class="inspector-field">
        <div class="inspector-field-label">${_humanizeKey(k)}</div>
        <div class="inspector-field-value">${_renderValue(row[k])}</div>
      </div>`).join('');
    html += `
      <div class="inspector-section">
        <div class="inspector-section-title">Other Attributes</div>
        <div class="inspector-section-grid">${rows}</div>
      </div>`;
  }

  return html;
}

export const RowInspector = {
  mount() {
    _overlayEl = document.createElement('div');
    _overlayEl.id = 'row-inspector-overlay';
    _overlayEl.className = 'inspector-overlay';
    _overlayEl.innerHTML = `<div class="inspector-panel" id="row-inspector-panel" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(_overlayEl);
    _panelEl = document.getElementById('row-inspector-panel');

    _overlayEl.addEventListener('click', (e) => {
      if (e.target === _overlayEl) RowInspector.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') RowInspector.close();
    });
  },

  /** Open the inspector for a given row object (snapshot, not live-bound). */
  open(row) {
    if (!_panelEl) return;
    _openId = row.project_id;

    const failed = row.project_status === 'Failed';
    const statusClass = failed ? 'status-crashed'
      : row.project_status === 'Active' ? 'status-active'
      : row.project_status === 'Completed' ? 'status-completed' : 'status-other';

    _panelEl.innerHTML = `
      <div class="inspector-header">
        <div>
          <div class="inspector-ticker mono">${row.project_id}</div>
          <div class="inspector-name">${row.project_name || '—'}</div>
        </div>
        <span class="inspector-status-badge ${statusClass}">${failed ? 'CRASHED' : (row.project_status || '—')}</span>
        <button class="inspector-close" id="row-inspector-close" aria-label="Close">✕</button>
      </div>
      <div class="inspector-banner">
        <span class="inspector-banner-icon">⏸</span>
        Snapshot frozen while market is halted — values won't drift while you read this.
      </div>
      <div class="inspector-body">${_buildSectionsHTML(row)}</div>
    `;

    document.getElementById('row-inspector-close').addEventListener('click', () => RowInspector.close());

    _overlayEl.classList.add('open');
  },

  close() {
    if (_overlayEl) _overlayEl.classList.remove('open');
    _openId = null;
  },

  isOpen() { return _openId !== null; },
  currentId() { return _openId; },
};
