/**
 * main.js
 * Entry point. Wires together CSV loading, stream adapter, store,
 * render scheduler, grid, and all feature modules.
 */

import { loadCSV }            from './data/csvLoader.js';
import { primeShadowState, startStream } from './data/streamAdapter.js';
import { TickerStore }        from './state/store.js';
import { RenderScheduler }    from './state/renderScheduler.js';
import { VirtualGrid }        from './grid/virtualGrid.js';
import { FilterEngine }       from './grid/filterEngine.js';
import { Sorter }             from './grid/sorter.js';
import { KpiBar }             from './features/kpiBar.js';
import { AlertFlash }         from './features/alertFlash.js';
import { PauseControl }       from './features/pauseControl.js';
import { LayoutPersistence }  from './features/layoutPersistence.js';
import { TickerTape }         from './features/tickerTape.js';
import { RowInspector }       from './features/rowInspector.js';
import { AnalyticsView }      from './features/analyticsView.js';
import { SnapshotExport }     from './features/snapshotExport.js';

// ─── DOM references ─────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

// ─── Boot sequence ───────────────────────────────────────────────────────────
async function boot() {
  _showLoading(true);

  // 1. Load CSV baseline
  let rows;
  try {
    rows = await loadCSV('./automation_projects.csv');
  } catch (err) {
    _showError(`Failed to load CSV: ${err.message}`);
    return;
  }

  // 2. Prime shadow state for stream adapter (prevents NaN on first batch)
  primeShadowState(rows);

  // 3. Load into store
  TickerStore.loadBaseline(rows);

  // 4. Mount feature modules
  KpiBar.mount($('kpi-bar'));
  AlertFlash.mount($('panel-crash-feed'));
  PauseControl.mount($('pause-control'));
  LayoutPersistence.mount($('layout-toggles'));
  TickerTape.mount($('panel-ticker-tape'));
  RowInspector.mount();
  AnalyticsView.mount($('analytics-control'));
  SnapshotExport.mount($('snapshot-export-control'));

  // 5. Build filter dropdowns from baseline data
  _buildFilterUI(rows);

  // 6. Mount & populate grid
  VirtualGrid.mount($('grid-container'));
  recomputeAndRender();

  // 7. Register render scheduler callbacks
  RenderScheduler.register(() => {
    KpiBar.render();
    TickerTape.render();
    AlertFlash.onCrashes(TickerStore.getJustFailedThisTick());
    recomputeAndRender();
    _updateResultCount();
  });

  RenderScheduler.start();

  // 8. Start the live stream
  startStream(batch => {
    TickerStore.applyBatch(batch);
    // Store marks itself dirty; scheduler picks it up next frame
  });

  _showLoading(false);
  _showApp(true);
}

// ─── Filter UI ───────────────────────────────────────────────────────────────
function _buildFilterUI(rows) {
  const options = FilterEngine.buildOptions(rows);

  const filterDefs = [
    { field: 'project_status',  label: 'Status',     elId: 'filter-status'  },
    { field: 'automation_type', label: 'Asset Class', elId: 'filter-type'    },
    { field: 'industry',        label: 'Sector',      elId: 'filter-industry'},
    { field: 'country',         label: 'Exchange',    elId: 'filter-country' },
  ];

  for (const { field, label, elId } of filterDefs) {
    const sel = $(elId);
    if (!sel) continue;

    sel.innerHTML = `<option value="">All ${label}s</option>` +
      options[field].map(v => `<option value="${v}">${v}</option>`).join('');

    sel.addEventListener('change', () => {
      FilterEngine.setFilter(field, sel.value);
      recomputeAndRender();
      _updateResultCount();
    });
  }

  // Search input
  const searchEl = $('search-input');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      FilterEngine.setSearch(searchEl.value);
      recomputeAndRender();
      _updateResultCount();
    });
  }

  // Clear filters button
  const clearBtn = $('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      FilterEngine.clearAll();
      filterDefs.forEach(d => { const el = $(d.elId); if (el) el.value = ''; });
      if (searchEl) searchEl.value = '';
      Sorter.clear();
      recomputeAndRender();
      _updateResultCount();
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function recomputeAndRender() {
  VirtualGrid.recompute();
  VirtualGrid.render();
}

function _updateResultCount() {
  const el = $('result-count');
  if (el) {
    const shown = VirtualGrid.getVisibleCount();
    const total = TickerStore.size();
    el.textContent = shown === total
      ? `${shown.toLocaleString()} securities`
      : `${shown.toLocaleString()} of ${total.toLocaleString()} securities`;
  }
}

function _showLoading(on) {
  const el = $('loading-screen');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function _showApp(on) {
  const el = $('app-shell');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function _showError(msg) {
  const el = $('loading-screen');
  if (el) el.innerHTML = `<div class="load-error">⚠ ${msg}</div>`;
}

// ─── Start ───────────────────────────────────────────────────────────────────
boot();
