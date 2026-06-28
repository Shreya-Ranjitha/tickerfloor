/**
 * virtualGrid.js
 * Hand-rolled virtualized grid. Feature 8 (15 pts).
 *
 * Core idea:
 *   - A fixed pool of real DOM row nodes sized to viewport height + buffer
 *   - Scrolling only swaps textContent/dataset on existing nodes — never creates/destroys
 *   - A single absolutely-positioned spacer div fakes the real scrollbar height
 *   - transform: translateY() positions the pooled rows (compositing only, no layout)
 *   - writeRowContent() is called every rAF tick for visible rows; it applies
 *     crash-flash CSS class based on TickerStore.didRecentlyFail()
 */

import { TickerStore } from '../state/store.js';
import { formatUSD, formatPct, formatInt, deltaArrow } from '../features/sanitize.js';
import { Sorter }       from './sorter.js';
import { FilterEngine } from './filterEngine.js';

const ROW_HEIGHT   = 36;   // px — must match CSS .grid-row height
const POOL_BUFFER  = 5;    // extra rows beyond visible area

// Column definitions
const COLUMNS = [
  { key: 'project_id',      label: 'Ticker',        width: '110px', mono: true  },
  { key: 'project_name',    label: 'Security Name', width: '200px', mono: false },
  { key: 'project_status',  label: 'Status',        width: '90px',  mono: false },
  { key: 'roi_percent',     label: 'Yield %',       width: '90px',  mono: true  },
  { key: 'robots_deployed', label: 'Units',         width: '70px',  mono: true  },
  { key: 'annual_savings_usd', label: 'Mkt Cap',    width: '110px', mono: true  },
  { key: 'automation_type', label: 'Asset Class',   width: '140px', mono: false },
  { key: 'industry',        label: 'Sector',        width: '150px', mono: false },
  { key: 'country',         label: 'Exchange',      width: '100px', mono: false },
  { key: 'budget_usd',      label: 'Budget',        width: '110px', mono: true  },
];

let _viewport   = null;  // scrollable container
let _rowWrapper = null;  // absolutely positioned inner wrapper
let _spacer     = null;  // height faker
let _rowPool    = [];    // fixed array of DOM row nodes
let _poolSize   = 0;

let _visibleIds = [];    // current sorted+filtered project_id array
let _startIdx   = 0;    // first visible row index

export const VirtualGrid = {

  /**
   * Mount the grid into containerEl, build the DOM skeleton.
   * @param {HTMLElement} containerEl
   */
  mount(containerEl) {
    containerEl.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'grid-header';
    for (const col of COLUMNS) {
      const cell = document.createElement('div');
      cell.className = 'grid-header-cell';
      cell.dataset.key = col.key;
      cell.style.width = col.width;
      cell.style.minWidth = col.width;
      cell.textContent = col.label;
      cell.title = `Sort by ${col.label} (Shift+click for multi-sort)`;
      cell.addEventListener('click', (e) => {
        Sorter.handleHeaderClick(col.key, e.shiftKey);
        VirtualGrid.recompute();
        VirtualGrid.render();
        _updateHeaderArrows();
      });
      header.appendChild(cell);
    }
    containerEl.appendChild(header);

    // Scroll viewport
    _viewport = document.createElement('div');
    _viewport.id = 'grid-viewport';
    _viewport.className = 'grid-viewport';
    containerEl.appendChild(_viewport);

    // Spacer (sets scrollbar height)
    _spacer = document.createElement('div');
    _spacer.className = 'grid-spacer';
    _viewport.appendChild(_spacer);

    // Row wrapper (translated to show correct window)
    _rowWrapper = document.createElement('div');
    _rowWrapper.className = 'grid-row-wrapper';
    _viewport.appendChild(_rowWrapper);

    // Build fixed pool
    _poolSize = Math.ceil(_viewport.clientHeight / ROW_HEIGHT) + POOL_BUFFER;
    for (let i = 0; i < _poolSize; i++) {
      const row = _buildPoolRow();
      _rowWrapper.appendChild(row);
      _rowPool.push(row);
    }

    _viewport.addEventListener('scroll', _onScroll, { passive: true });
  },

  /** Recompute visibleIds from current store + sort + filter state */
  recompute() {
    const allRows = TickerStore.getAllRows();
    const filtered = FilterEngine.filter(allRows);
    const sorted   = Sorter.sort(filtered);
    _visibleIds = sorted.map(r => r.project_id);

    // Update spacer height
    if (_spacer) _spacer.style.height = `${_visibleIds.length * ROW_HEIGHT}px`;
  },

  /** Paint visible rows from current scroll position */
  render() {
    if (!_viewport) return;
    const scrollTop = _viewport.scrollTop;
    _startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 1);

    // Clamp start so we don't go past the end
    const maxStart = Math.max(0, _visibleIds.length - _poolSize);
    _startIdx = Math.min(_startIdx, maxStart);

    // Translate wrapper to correct Y position
    _rowWrapper.style.transform = `translateY(${_startIdx * ROW_HEIGHT}px)`;

    for (let i = 0; i < _poolSize; i++) {
      const dataIdx = _startIdx + i;
      const poolNode = _rowPool[i];
      if (dataIdx < _visibleIds.length) {
        const id  = _visibleIds[dataIdx];
        const row = TickerStore.get(id);
        if (row) {
          _writeRowContent(poolNode, row);
          poolNode.style.display = '';
        } else {
          poolNode.style.display = 'none';
        }
      } else {
        poolNode.style.display = 'none';
      }
    }
  },

  /** Expose for external callers (main.js) */
  getVisibleCount() { return _visibleIds.length; },
};

// --- Private helpers ---

function _buildPoolRow() {
  const row = document.createElement('div');
  row.className = 'grid-row';
  row.style.height = `${ROW_HEIGHT}px`;
  for (const col of COLUMNS) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell' + (col.mono ? ' mono' : '');
    cell.style.width    = col.width;
    cell.style.minWidth = col.width;
    row.appendChild(cell);
  }
  return row;
}

function _writeRowContent(rowNode, row) {
  const cells = rowNode.children;
  const prev  = TickerStore.getPrev(row.project_id);

  // Crash flash
  const failed = row.project_status === 'Failed';
  const recentFail = TickerStore.didRecentlyFail(row.project_id);

  if (recentFail && !rowNode.classList.contains('row-crash-flash')) {
    rowNode.classList.add('row-crash-flash');
  } else if (!recentFail && rowNode.classList.contains('row-crash-flash')) {
    rowNode.classList.remove('row-crash-flash');
  }

  // Row base classes
  rowNode.classList.toggle('row-failed',   failed);
  rowNode.classList.toggle('row-negative', !failed && Number(row.roi_percent) < 0);

  const roiArrow = prev ? deltaArrow(row.roi_percent, prev.roi_percent) : { symbol: '', cls: '' };

  COLUMNS.forEach((col, i) => {
    const cell = cells[i];
    let text = '';
    let extraClass = '';

    switch (col.key) {
      case 'project_id':
        text = row.project_id;
        break;
      case 'project_name':
        text = row.project_name || '—';
        break;
      case 'project_status': {
        text = failed ? 'CRASHED' : (row.project_status || '—');
        extraClass = failed ? 'status-crashed' :
                     row.project_status === 'Active' ? 'status-active' :
                     row.project_status === 'Completed' ? 'status-completed' : 'status-other';
        break;
      }
      case 'roi_percent':
        text = `${formatPct(row.roi_percent)} ${roiArrow.symbol}`;
        extraClass = roiArrow.cls + (Number(row.roi_percent) < 0 ? ' yield-negative' : ' yield-positive');
        break;
      case 'robots_deployed':
        text = formatInt(row.robots_deployed);
        break;
      case 'annual_savings_usd':
        text = formatUSD(row.annual_savings_usd);
        break;
      case 'automation_type':
        text = row.automation_type || '—';
        break;
      case 'industry':
        text = row.industry || '—';
        break;
      case 'country':
        text = row.country || '—';
        break;
      case 'budget_usd':
        text = formatUSD(row.budget_usd);
        break;
    }

    if (cell.textContent !== text) cell.textContent = text;

    // Only touch className if it changed (avoid unnecessary style recalcs)
    const wanted = 'grid-cell' + (col.mono ? ' mono' : '') + (extraClass ? ' ' + extraClass : '');
    if (cell.className !== wanted) cell.className = wanted;
  });
}

function _onScroll() {
  VirtualGrid.render();
}

function _updateHeaderArrows() {
  const headerCells = document.querySelectorAll('.grid-header-cell');
  headerCells.forEach(cell => {
    const key  = cell.dataset.key;
    const dir  = Sorter.getDirFor(key);
    const base = COLUMNS.find(c => c.key === key)?.label || key;
    if (dir) {
      cell.textContent = `${base} ${dir === 'asc' ? '▲' : '▼'}`;
      cell.classList.add('sorted');
    } else {
      cell.textContent = base;
      cell.classList.remove('sorted');
    }
  });
}
