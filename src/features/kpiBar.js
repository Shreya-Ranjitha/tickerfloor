/**
 * kpiBar.js
 * High-Density KPI strip — Feature 1 (10 pts).
 * Exactly the three counters the spec requires:
 *   1. Total Streamed Rows Processed — running count of every row delivered
 *      by the stream since boot (including repeat updates), strictly
 *      increasing every ~200ms tick.
 *   2. Active Robots Deployed Count — running sum of robots_deployed
 *      across all currently-tracked rows.
 *   3. Global Cumulative Savings — running sum of annual_savings_usd
 *      across all currently-tracked rows.
 */

import { TickerStore } from '../state/store.js';
import { formatInt, formatUSD } from './sanitize.js';

let _elStreamed = null;
let _elUnits    = null;
let _elCap      = null;
let _elUnitsΔ   = null;
let _elCapΔ     = null;

export const KpiBar = {
  mount(containerEl) {
    containerEl.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Total Streamed Rows Processed</div>
        <div class="kpi-value mono" id="kpi-streamed">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Active Robots Deployed Count</div>
        <div class="kpi-value mono" id="kpi-units">—</div>
        <div class="kpi-delta" id="kpi-units-delta"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Global Cumulative Savings</div>
        <div class="kpi-value mono" id="kpi-cap">—</div>
        <div class="kpi-delta" id="kpi-cap-delta"></div>
      </div>
    `;
    _elStreamed = document.getElementById('kpi-streamed');
    _elUnits    = document.getElementById('kpi-units');
    _elCap      = document.getElementById('kpi-cap');
    _elUnitsΔ   = document.getElementById('kpi-units-delta');
    _elCapΔ     = document.getElementById('kpi-cap-delta');
  },

  /** Called each render frame */
  render() {
    if (!_elStreamed) return;

    _elStreamed.textContent = formatInt(TickerStore.getTotalRowsStreamed());

    const units = TickerStore.getTotalRobots();
    const cap   = TickerStore.getTotalSavings();
    const baseU = TickerStore.getBaselineRobots();
    const baseC = TickerStore.getBaselineSavings();

    _elUnits.textContent = formatInt(units);
    _elCap.textContent   = formatUSD(cap);

    // Delta from baseline
    const deltaU = units - baseU;
    const deltaC = cap   - baseC;

    _renderDelta(_elUnitsΔ, deltaU, formatInt(Math.abs(deltaU)));
    _renderDelta(_elCapΔ,   deltaC, formatUSD(Math.abs(deltaC)));
  },
};

function _renderDelta(el, delta, formatted) {
  if (!Number.isFinite(delta) || delta === 0) {
    el.textContent = '';
    el.className   = 'kpi-delta';
    return;
  }
  const up = delta > 0;
  el.textContent = `${up ? '▲' : '▼'} ${formatted}`;
  el.className   = `kpi-delta ${up ? 'delta-up' : 'delta-down'}`;
}

