/**
 * kpiBar.js
 * TickerFloor Index KPI strip — three live streaming counters.
 *   1. Listed Securities (total row count)
 *   2. Units Deployed (total robots_deployed, with delta)
 *   3. Index Cap (total annual_savings_usd, with delta)
 */

import { TickerStore } from '../state/store.js';
import { formatInt, formatUSD } from './sanitize.js';

let _elCount   = null;
let _elUnits   = null;
let _elCap     = null;
let _elUnitsΔ  = null;
let _elCapΔ    = null;

export const KpiBar = {
  mount(containerEl) {
    containerEl.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Listed Securities</div>
        <div class="kpi-value mono" id="kpi-count">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Units Deployed</div>
        <div class="kpi-value mono" id="kpi-units">—</div>
        <div class="kpi-delta" id="kpi-units-delta"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Index Cap (Savings)</div>
        <div class="kpi-value mono" id="kpi-cap">—</div>
        <div class="kpi-delta" id="kpi-cap-delta"></div>
      </div>
    `;
    _elCount  = document.getElementById('kpi-count');
    _elUnits  = document.getElementById('kpi-units');
    _elCap    = document.getElementById('kpi-cap');
    _elUnitsΔ = document.getElementById('kpi-units-delta');
    _elCapΔ   = document.getElementById('kpi-cap-delta');
  },

  /** Called each render frame */
  render() {
    if (!_elCount) return;

    _elCount.textContent = formatInt(TickerStore.size());

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
