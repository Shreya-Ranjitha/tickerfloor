/**
 * sorter.js
 * Single-column and shift-click multi-column compound sort.
 * Operates on arrays of row objects; returns a new sorted array (no mutation).
 */

// Sort state: array of { key, dir: 'asc'|'desc' }
let _sortStack = [];

const NUMERIC_FIELDS = new Set([
  'robots_deployed', 'roi_percent', 'annual_savings_usd',
  'employee_hours_saved', 'budget_usd', 'implementation_time_days',
]);

function compareValues(a, b, key, dir) {
  let va = a[key];
  let vb = b[key];

  if (NUMERIC_FIELDS.has(key)) {
    va = Number(va) || 0;
    vb = Number(vb) || 0;
    return dir === 'asc' ? va - vb : vb - va;
  }

  // String comparison
  va = (va ?? '').toString().toLowerCase();
  vb = (vb ?? '').toString().toLowerCase();
  if (va < vb) return dir === 'asc' ? -1 : 1;
  if (va > vb) return dir === 'asc' ?  1 : -1;
  return 0;
}

export const Sorter = {
  /**
   * Handle a column header click.
   * @param {string} key - field name
   * @param {boolean} isShift - true if shift key held (multi-sort)
   */
  handleHeaderClick(key, isShift) {
    if (isShift) {
      const existing = _sortStack.find(s => s.key === key);
      if (existing) {
        existing.dir = existing.dir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortStack.push({ key, dir: 'asc' });
      }
    } else {
      // Single-click cycle: none -> asc -> desc -> none
      const isSoleSort = _sortStack.length === 1 && _sortStack[0].key === key;
      if (!isSoleSort) {
        _sortStack = [{ key, dir: 'asc' }];
      } else if (_sortStack[0].dir === 'asc') {
        _sortStack = [{ key, dir: 'desc' }];
      } else {
        _sortStack = [];
      }
    }
  },

  /** Sort an array of rows according to the current sort stack. Returns new array. */
  sort(rows) {
    if (_sortStack.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const { key, dir } of _sortStack) {
        const r = compareValues(a, b, key, dir);
        if (r !== 0) return r;
      }
      return 0;
    });
  },

  /** Current sort stack (for rendering header arrows) */
  getStack() { return _sortStack; },

  /** Clear all sorts */
  clear() { _sortStack = []; },

  hasSortOn(key) { return _sortStack.some(s => s.key === key); },

  getDirFor(key) {
    const s = _sortStack.find(s => s.key === key);
    return s ? s.dir : null;
  },
};
