/**
 * alertFlash.js
 * "Crash Feed" side panel — secondary alert surface showing recent failures.
 * The primary flash is the grid row's CSS animation (row-crash-flash class in virtualGrid.js).
 * This panel captures one-shot crash events from TickerStore.getJustFailedThisTick()
 * and shows a persistent log the user can see regardless of scroll position.
 */

import { formatPct } from './sanitize.js';

const MAX_FEED_ITEMS = 50;
let _feedEl = null;
let _entries = []; // { id, name, roi, ts }

export const AlertFlash = {
  mount(containerEl) {
    containerEl.innerHTML = `
      <div class="crash-feed-header">
        <span class="crash-icon">⚠</span> Crash Feed
        <button class="crash-feed-clear" id="crash-feed-clear">Clear</button>
      </div>
      <div class="crash-feed-list" id="crash-feed-list"></div>
    `;
    _feedEl = document.getElementById('crash-feed-list');
    document.getElementById('crash-feed-clear').addEventListener('click', () => {
      _entries = [];
      _feedEl.innerHTML = '';
    });
  },

  /**
   * Called each render tick with the one-shot failed rows from this tick.
   * @param {Array} justFailed - rows that transitioned to Failed this tick
   */
  onCrashes(justFailed) {
    if (!justFailed.length || !_feedEl) return;

    for (const row of justFailed) {
      _entries.unshift({
        id:  row.project_id,
        name: row.project_name || row.project_id,
        roi:  row.roi_percent,
        ts:   new Date().toLocaleTimeString(),
      });
    }

    // Cap list size
    if (_entries.length > MAX_FEED_ITEMS) _entries.length = MAX_FEED_ITEMS;

    // Re-render feed
    _feedEl.innerHTML = _entries.map(e => `
      <div class="crash-feed-item">
        <span class="crash-feed-ticker mono">${e.id}</span>
        <span class="crash-feed-name">${e.name}</span>
        <span class="crash-feed-yield yield-negative mono">${formatPct(e.roi)}</span>
        <span class="crash-feed-time">${e.ts}</span>
      </div>
    `).join('');
  },

  getCrashCount() { return _entries.length; },
};
