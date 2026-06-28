/**
 * streamAdapter.js
 * Wraps window.initializeRpaStream and repairs dataStream.js's schema mismatch.
 * dataStream.js mutates fields from a completely different schema (employee_count,
 * annual_revenue_usd, etc.) which don't exist in automation_projects.csv.
 * We maintain our own clean shadow state per row and derive realistic mutations
 * on the actual fields the PDF spec requires.
 */

const CRASH_PROBABILITY = 0.015;    // ~1.5% chance per touched row per tick
const RECOVERY_PROBABILITY = 0.25;  // 25% chance a crashed row recovers each tick
const ROI_NEGATIVE_PROBABILITY = 0.03; // 3% chance of negative ROI swing

// Clean shadow state: Map<project_id, cleanRow> so we always have sane baselines
const shadowState = new Map();

/**
 * Sanitize a row's numeric fields against the shadow state.
 * If dataStream.js has corrupted a value to NaN/null, fall back to the last
 * known-good value from our own shadow, or a safe default.
 */
function sanitizeRow(row) {
  const shadow = shadowState.get(row.project_id) || {};

  const clean = { ...row };

  const numField = (field, fallback) => {
    const v = Number(row[field]);
    if (Number.isFinite(v)) return v;
    const sv = Number(shadow[field]);
    if (Number.isFinite(sv)) return sv;
    return fallback;
  };

  clean.robots_deployed       = numField('robots_deployed', 1);
  clean.roi_percent           = numField('roi_percent', 0);
  clean.annual_savings_usd    = numField('annual_savings_usd', 0);
  clean.employee_hours_saved  = numField('employee_hours_saved', 0);
  clean.budget_usd            = numField('budget_usd', 10000);
  clean.implementation_time_days = numField('implementation_time_days', 30);

  return clean;
}

/** Small random integer in [min, max) */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** Random float in [min, max) */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Apply realistic jitter to clean fields on an already-sanitized row.
 * Returns a new row object; does not mutate input.
 */
function applyTickerJitter(row) {
  const r = { ...row };

  // Status transitions
  if (r.project_status === 'Failed') {
    if (Math.random() < RECOVERY_PROBABILITY) {
      r.project_status = 'Active';
    }
  } else if (r.project_status === 'Active' || r.project_status === 'Planned') {
    if (Math.random() < CRASH_PROBABILITY) {
      r.project_status = 'Failed';
    }
  }

  // ROI jitter — occasionally swing negative
  const roiDelta = randFloat(-2.5, 3.0);
  r.roi_percent = Math.max(
    Math.random() < ROI_NEGATIVE_PROBABILITY ? -50 : -5,
    Math.min(500, r.roi_percent + roiDelta)
  );

  // Robots deployed — small integer noise
  r.robots_deployed = Math.max(1, r.robots_deployed + randInt(-1, 3));

  // Savings — correlated with robots
  const savingsDelta = randInt(-5000, 15000);
  r.annual_savings_usd = Math.max(0, r.annual_savings_usd + savingsDelta);

  // Hours saved — small noise
  r.employee_hours_saved = Math.max(0, r.employee_hours_saved + randInt(-10, 25));

  return r;
}

/**
 * Process a raw batch from dataStream.js:
 *   1. Sanitize against shadow state
 *   2. Apply our own jitter on the real fields
 *   3. Update shadow state with clean values
 * Returns the cleaned+mutated batch array.
 */
function processBatch(rawBatch) {
  return rawBatch.map(rawRow => {
    const sanitized = sanitizeRow(rawRow);
    const mutated   = applyTickerJitter(sanitized);

    // Update shadow with the clean result
    shadowState.set(mutated.project_id, { ...mutated });

    return mutated;
  });
}

/**
 * Prime the shadow state from the initial CSV load so every row starts with
 * sane numeric baselines before any stream batches arrive.
 */
export function primeShadowState(rows) {
  for (const row of rows) {
    shadowState.set(row.project_id, { ...row });
  }
}

/**
 * Initialize the stream. Calls window.initializeRpaStream (from dataStream.js)
 * and wraps each batch through our repair pipeline before passing to onBatch.
 *
 * @param {function(Array)} onBatch - called with each cleaned batch
 */
export function startStream(onBatch, csvUrl = './automation_projects.csv') {
  if (typeof window.initializeRpaStream !== 'function') {
    console.error('[streamAdapter] window.initializeRpaStream not found — is dataStream.js loaded?');
    return;
  }

  window.initializeRpaStream((rawBatch) => {
    const cleanBatch = processBatch(rawBatch);
    onBatch(cleanBatch);
  }, csvUrl);
}
