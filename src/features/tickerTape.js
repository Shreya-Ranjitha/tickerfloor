/**
 * tickerTape.js
 * Scrolling marquee of the top 5 movers/losers by absolute yield delta.
 * The signature "bold element" of the trading-floor UI — everything else stays quiet.
 * Rendered as a CSS marquee so it's pure DOM/CSS, no canvas needed.
 */

import { TickerStore } from '../state/store.js';
import { formatPct }   from '../features/sanitize.js';

let _tapeEl  = null;
let _innerEl = null;

export const TickerTape = {
  mount(containerEl) {
    containerEl.innerHTML = `
      <div class="tape-label">RFX LIVE</div>
      <div class="tape-track" id="tape-track">
        <div class="tape-inner" id="tape-inner"></div>
      </div>
    `;
    _tapeEl  = document.getElementById('tape-track');
    _innerEl = document.getElementById('tape-inner');
  },

  /** Update the tape with the latest top movers. Called each render frame. */
  render() {
    if (!_innerEl) return;

    // Find top 10 rows by |roi_percent change| — use rows with prev values
    const rows = TickerStore.getAllRows();
    const movers = [];

    for (const row of rows) {
      const prev = TickerStore.getPrev(row.project_id);
      if (!prev) continue;
      const delta = Number(row.roi_percent) - Number(prev.roi_percent);
      if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) continue;
      movers.push({ row, delta });
    }

    // Sort by absolute delta, take top 8
    movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top = movers.slice(0, 8);

    if (top.length === 0) return; // no movers yet; keep existing tape

    const items = top.map(({ row, delta }) => {
      const up  = delta > 0;
      const cls = up ? 'tape-item-up' : 'tape-item-down';
      const arr = up ? '▲' : '▼';
      return `<span class="tape-item ${cls}">
        <span class="tape-ticker mono">${row.project_id}</span>
        <span class="tape-yield mono">${formatPct(row.roi_percent)}</span>
        <span class="tape-arrow">${arr}</span>
      </span>`;
    });

    // Duplicate for seamless loop
    const html = [...items, ...items].join('<span class="tape-sep">|</span>');
    _innerEl.innerHTML = html;
  },
};
