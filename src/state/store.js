/**
 * store.js — TickerStore
 * Single source of truth: Map<project_id, row>.
 * O(1) upsert, delta tracking for yield arrows, crash detection.
 *
 * Exposed as a global (window.TickerStore) so Puppeteer tests and devtools
 * can inspect it easily, and so other modules can import without circular deps.
 */

const _store = new Map();           // project_id → current row
const _prevValues = new Map();      // project_id → { roi_percent, robots_deployed, annual_savings_usd }

// One-shot per-tick crash tracking (consumed by crash feed, reset each applyBatch)
let _justFailedThisTick = [];

// Timestamp-based recent-failure tracking (consumed by grid flash, persists for FLASH_WINDOW_MS)
const FLASH_WINDOW_MS = 12000;
const _recentFailures = new Map(); // project_id → timestamp of last failure

// Running sums for KPI bar
let _totalRobots = 0;
let _totalSavings = 0;
let _totalHours = 0;
let _isDirty = false;

// Baseline captured at CSV load for KPI deltas
let _baselineRobots = 0;
let _baselineSavings = 0;

export const TickerStore = {

  /** Load initial CSV rows into the store. Sets baselines for KPI bar. */
  loadBaseline(rows) {
    let sumRobots = 0, sumSavings = 0, sumHours = 0;
    for (const row of rows) {
      _store.set(row.project_id, row);
      const r = Number.isFinite(Number(row.robots_deployed))    ? Number(row.robots_deployed)    : 0;
      const s = Number.isFinite(Number(row.annual_savings_usd)) ? Number(row.annual_savings_usd) : 0;
      const h = Number.isFinite(Number(row.employee_hours_saved))? Number(row.employee_hours_saved): 0;
      sumRobots  += r;
      sumSavings += s;
      sumHours   += h;
    }
    _totalRobots  = sumRobots;
    _totalSavings = sumSavings;
    _totalHours   = sumHours;
    _baselineRobots  = sumRobots;
    _baselineSavings = sumSavings;
    _isDirty = true;
  },

  /**
   * Apply a batch of incoming stream rows.
   * Updates store, running sums, delta tracking, and crash detection.
   * @param {Array} batch
   * @returns {{ deltaRobots: number, deltaSavings: number }} per-batch running deltas
   */
  applyBatch(batch) {
    _justFailedThisTick = [];
    let deltaRobots = 0, deltaSavings = 0;

    for (const row of batch) {
      const prev = _store.get(row.project_id);

      if (prev) {
        // Track numeric deltas for yield arrows
        _prevValues.set(row.project_id, {
          roi_percent:       prev.roi_percent,
          robots_deployed:   prev.robots_deployed,
          annual_savings_usd: prev.annual_savings_usd,
        });

        // Update running sums
        const prevR = Number.isFinite(Number(prev.robots_deployed))    ? Number(prev.robots_deployed)    : 0;
        const prevS = Number.isFinite(Number(prev.annual_savings_usd)) ? Number(prev.annual_savings_usd) : 0;
        const newR  = Number.isFinite(Number(row.robots_deployed))     ? Number(row.robots_deployed)     : prevR;
        const newS  = Number.isFinite(Number(row.annual_savings_usd))  ? Number(row.annual_savings_usd)  : prevS;

        _totalRobots  += newR  - prevR;
        _totalSavings += newS  - prevS;
        deltaRobots   += newR  - prevR;
        deltaSavings  += newS  - prevS;

        // Crash detection
        if (row.project_status === 'Failed' && prev.project_status !== 'Failed') {
          _justFailedThisTick.push(row);
          _recentFailures.set(row.project_id, Date.now());
        }
      } else {
        // New row (shouldn't happen often post-baseline, but guard it)
        const r = Number.isFinite(Number(row.robots_deployed))    ? Number(row.robots_deployed)    : 0;
        const s = Number.isFinite(Number(row.annual_savings_usd)) ? Number(row.annual_savings_usd) : 0;
        const h = Number.isFinite(Number(row.employee_hours_saved))? Number(row.employee_hours_saved): 0;
        _totalRobots  += r;
        _totalSavings += s;
        _totalHours   += h;
      }

      _store.set(row.project_id, row);
    }

    // Prune stale recent-failure entries
    const cutoff = Date.now() - FLASH_WINDOW_MS;
    for (const [id, ts] of _recentFailures) {
      if (ts < cutoff) _recentFailures.delete(id);
    }

    _isDirty = true;
    return { deltaRobots, deltaSavings };
  },

  /** O(1) row lookup */
  get(id) { return _store.get(id); },

  /** All rows as an array (for sort/filter — avoid calling on hot path) */
  getAllRows() { return Array.from(_store.values()); },

  /** All project_ids as insertion-order array */
  getAllIds() { return Array.from(_store.keys()); },

  size() { return _store.size; },

  // --- Delta / flash accessors ---

  /** Previous numeric snapshot for delta arrows */
  getPrev(id) { return _prevValues.get(id) || null; },

  /** True if this row just transitioned to Failed this tick (one-shot, for crash feed) */
  getJustFailedThisTick() { return _justFailedThisTick; },

  /**
   * True if this row failed within the last FLASH_WINDOW_MS milliseconds.
   * Used by the grid to apply the sustained crash-flash CSS class.
   */
  didRecentlyFail(id) {
    const ts = _recentFailures.get(id);
    if (!ts) return false;
    return Date.now() - ts < FLASH_WINDOW_MS;
  },

  // --- KPI accessors ---

  getTotalRobots()  { return _totalRobots;  },
  getTotalSavings() { return _totalSavings; },
  getTotalHours()   { return _totalHours;   },

  getBaselineRobots()  { return _baselineRobots;  },
  getBaselineSavings() { return _baselineSavings; },

  // --- Render scheduler integration ---

  isDirty()      { return _isDirty; },
  clearDirty()   { _isDirty = false; },
  markDirty()    { _isDirty = true; },
};

// Expose globally for devtools + Puppeteer tests
window.TickerStore = TickerStore;
