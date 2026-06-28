/**
 * analyticsView.js
 * Bounty feature: an "Analytics View" toggle that, while the market is
 * halted, opens an overlay dashboard aggregating the current dataset into
 * Chart.js visualizations. Gated on pause for the same reason the row
 * inspector is: the underlying rows mutate every ~200ms while live, so any
 * aggregate computed from them would be stale the instant it rendered.
 *
 * Chart.js is the only charting library used anywhere in this feature,
 * per the bounty constraint. Loaded globally via CDN <script> in index.html
 * (window.Chart) — no other charting lib is imported or referenced.
 */

import { TickerStore }   from '../state/store.js';
import { FilterEngine }  from '../grid/filterEngine.js';
import { formatUSD, formatPct, formatInt } from './sanitize.js';

let _overlayEl  = null;
let _panelEl    = null;
let _toggleBtn  = null;
let _charts     = [];   // active Chart.js instances, destroyed on close
let _isOpen     = false;

const PALETTE = {
  teal:   '#5eead4',
  green:  '#4ade80',
  red:    '#f87171',
  amber:  '#fbbf24',
  blue:   '#60a5fa',
  violet: '#a78bfa',
  grid:   'rgba(255,255,255,0.06)',
  text:   '#9aa7b2',
};
const SERIES_COLORS = [PALETTE.teal, PALETTE.blue, PALETTE.amber, PALETTE.violet, PALETTE.green, PALETTE.red, '#fb923c', '#38bdf8'];

function _destroyCharts() {
  _charts.forEach(c => c.destroy());
  _charts = [];
}

/** Aggregate the given rows into everything the dashboard needs, in one pass. */
function _aggregate(rows) {
  const statusCounts   = {};
  const assetCounts     = {};
  const sectorSavings   = {};   // industry -> total annual_savings_usd
  const roiBuckets      = { '<0%': 0, '0-50%': 0, '50-150%': 0, '150-300%': 0, '300%+': 0 };
  let totalSavings = 0, totalBudget = 0, totalUnits = 0, n = 0;

  for (const r of rows) {
    n++;
    statusCounts[r.project_status]   = (statusCounts[r.project_status]   || 0) + 1;
    assetCounts[r.automation_type]   = (assetCounts[r.automation_type]   || 0) + 1;
    sectorSavings[r.industry]        = (sectorSavings[r.industry]        || 0) + (Number(r.annual_savings_usd) || 0);

    totalSavings += Number(r.annual_savings_usd) || 0;
    totalBudget  += Number(r.budget_usd) || 0;
    totalUnits   += Number(r.robots_deployed) || 0;

    const roi = Number(r.roi_percent) || 0;
    if (roi < 0) roiBuckets['<0%']++;
    else if (roi < 50) roiBuckets['0-50%']++;
    else if (roi < 150) roiBuckets['50-150%']++;
    else if (roi < 300) roiBuckets['150-300%']++;
    else roiBuckets['300%+']++;
  }

  const topSectors = Object.entries(sectorSavings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return { n, statusCounts, assetCounts, roiBuckets, topSectors, totalSavings, totalBudget, totalUnits };
}

function _summaryHTML(agg) {
  return `
    <div class="analytics-summary">
      <div class="analytics-stat">
        <div class="analytics-stat-label">Securities in View</div>
        <div class="analytics-stat-value">${formatInt(agg.n)}</div>
      </div>
      <div class="analytics-stat">
        <div class="analytics-stat-label">Aggregate Annual Savings</div>
        <div class="analytics-stat-value">${formatUSD(agg.totalSavings)}</div>
      </div>
      <div class="analytics-stat">
        <div class="analytics-stat-label">Aggregate Budget</div>
        <div class="analytics-stat-value">${formatUSD(agg.totalBudget)}</div>
      </div>
      <div class="analytics-stat">
        <div class="analytics-stat-label">Total Units Deployed</div>
        <div class="analytics-stat-value">${formatInt(agg.totalUnits)}</div>
      </div>
    </div>`;
}

function _baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { labels: { color: PALETTE.text, font: { size: 11 } } },
      ...extra.plugins,
    },
    scales: extra.scales,
  };
}

function _renderCharts(agg) {
  const { Chart } = window;
  if (!Chart) {
    console.error('[analyticsView] Chart.js not found on window — check the CDN <script> tag in index.html');
    return;
  }

  // 1. Status distribution — doughnut
  const statusLabels = Object.keys(agg.statusCounts);
  _charts.push(new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels: statusLabels,
      datasets: [{
        data: statusLabels.map(k => agg.statusCounts[k]),
        backgroundColor: statusLabels.map((s, i) =>
          s === 'Failed' ? PALETTE.red : s === 'Active' ? PALETTE.green : s === 'Completed' ? PALETTE.teal : SERIES_COLORS[i % SERIES_COLORS.length]),
        borderColor: '#0b1116',
        borderWidth: 2,
      }],
    },
    options: _baseOptions(),
  }));

  // 2. Asset class breakdown — bar
  const assetLabels = Object.keys(agg.assetCounts).sort((a, b) => agg.assetCounts[b] - agg.assetCounts[a]);
  _charts.push(new Chart(document.getElementById('chart-assets'), {
    type: 'bar',
    data: {
      labels: assetLabels,
      datasets: [{
        label: 'Projects',
        data: assetLabels.map(k => agg.assetCounts[k]),
        backgroundColor: PALETTE.blue,
        borderRadius: 4,
      }],
    },
    options: _baseOptions({
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: PALETTE.text, autoSkip: false, maxRotation: 60, minRotation: 30, font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: PALETTE.text }, grid: { color: PALETTE.grid } },
      },
    }),
  }));

  // 3. Top sectors by annual savings — horizontal bar
  _charts.push(new Chart(document.getElementById('chart-sectors'), {
    type: 'bar',
    data: {
      labels: agg.topSectors.map(([k]) => k),
      datasets: [{
        label: 'Annual Savings',
        data: agg.topSectors.map(([, v]) => v),
        backgroundColor: PALETTE.teal,
        borderRadius: 4,
      }],
    },
    options: _baseOptions({
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatUSD(ctx.parsed.x) } },
      },
      scales: {
        x: { ticks: { color: PALETTE.text, callback: v => formatUSD(v) }, grid: { color: PALETTE.grid } },
        y: { ticks: { color: PALETTE.text, font: { size: 10 } }, grid: { display: false } },
      },
    }),
  }));

  // 4. ROI distribution — bar
  const roiLabels = Object.keys(agg.roiBuckets);
  _charts.push(new Chart(document.getElementById('chart-roi'), {
    type: 'bar',
    data: {
      labels: roiLabels,
      datasets: [{
        label: 'Projects',
        data: roiLabels.map(k => agg.roiBuckets[k]),
        backgroundColor: roiLabels.map(l => l === '<0%' ? PALETTE.red : PALETTE.amber),
        borderRadius: 4,
      }],
    },
    options: _baseOptions({
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: PALETTE.text }, grid: { display: false } },
        y: { ticks: { color: PALETTE.text }, grid: { color: PALETTE.grid } },
      },
    }),
  }));
}

export const AnalyticsView = {
  mount(toggleContainer) {
    // Toggle button
    if (toggleContainer) {
      toggleContainer.innerHTML = `
        <button id="analytics-toggle-btn" class="analytics-toggle-btn" disabled
          title="Halt the market to enable Analytics View">
          <span class="analytics-icon">📊</span> Analytics View
        </button>`;
      _toggleBtn = document.getElementById('analytics-toggle-btn');
      _toggleBtn.addEventListener('click', () => AnalyticsView.open());
    }

    // Overlay
    _overlayEl = document.createElement('div');
    _overlayEl.id = 'analytics-overlay';
    _overlayEl.className = 'inspector-overlay analytics-overlay';
    _overlayEl.innerHTML = `<div class="inspector-panel analytics-panel" id="analytics-panel" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(_overlayEl);
    _panelEl = document.getElementById('analytics-panel');

    _overlayEl.addEventListener('click', (e) => {
      if (e.target === _overlayEl) AnalyticsView.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _isOpen) AnalyticsView.close();
    });
  },

  /** Enable/disable the toggle button based on pause state. Called by pauseControl. */
  setEnabled(paused) {
    if (!_toggleBtn) return;
    _toggleBtn.disabled = !paused;
    _toggleBtn.title = paused ? 'Open the analytics dashboard' : 'Halt the market to enable Analytics View';
    if (!paused) AnalyticsView.close();
  },

  open() {
    if (!_panelEl || _toggleBtn?.disabled) return;

    const rows = FilterEngine.filter(TickerStore.getAllRows());
    const agg  = _aggregate(rows);

    _panelEl.innerHTML = `
      <div class="inspector-header">
        <div>
          <div class="inspector-ticker mono">Analytics View</div>
          <div class="inspector-name">Aggregated from ${formatInt(agg.n)} securities currently in view (filters applied)</div>
        </div>
        <button class="inspector-close" id="analytics-close" aria-label="Close">✕</button>
      </div>
      <div class="inspector-banner">
        <span class="inspector-banner-icon">⏸</span>
        Snapshot frozen while market is halted — charts reflect this instant, not a live feed.
      </div>
      <div class="analytics-body">
        ${_summaryHTML(agg)}
        <div class="analytics-grid">
          <div class="analytics-chart-card">
            <div class="analytics-chart-title">Status Distribution</div>
            <div class="analytics-chart-wrap"><canvas id="chart-status"></canvas></div>
          </div>
          <div class="analytics-chart-card">
            <div class="analytics-chart-title">Asset Class Breakdown</div>
            <div class="analytics-chart-wrap"><canvas id="chart-assets"></canvas></div>
          </div>
          <div class="analytics-chart-card">
            <div class="analytics-chart-title">Top Sectors by Annual Savings</div>
            <div class="analytics-chart-wrap"><canvas id="chart-sectors"></canvas></div>
          </div>
          <div class="analytics-chart-card">
            <div class="analytics-chart-title">ROI Distribution</div>
            <div class="analytics-chart-wrap"><canvas id="chart-roi"></canvas></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('analytics-close').addEventListener('click', () => AnalyticsView.close());

    _destroyCharts();
    _renderCharts(agg);

    _overlayEl.classList.add('open');
    _isOpen = true;
  },

  close() {
    if (_overlayEl) _overlayEl.classList.remove('open');
    _destroyCharts();
    _isOpen = false;
  },

  isOpen() { return _isOpen; },
};
