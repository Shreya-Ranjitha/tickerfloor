/**
 * sanitize.js
 * Shared number formatting utilities used by the KPI bar and grid cells.
 * All functions are pure and safe against non-finite inputs.
 */

/** Format a USD value with full comma-grouped digits: $1,234,567 */
export function formatUSD(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$—';
  const rounded = Math.round(v);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** Format a ROI/percent value with sign: +12.34%, -5.20% */
export function formatPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—%';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

/** Format an integer with comma separators */
export function formatInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('en-US');
}

/** Format hours saved compactly: 1.2M hrs, 45.6K hrs */
export function formatHours(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M hrs`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K hrs`;
  return `${Math.round(v)} hrs`;
}

/**
 * Delta arrow for yield/price change.
 * Returns { symbol: '▲'|'▼'|'—', cls: 'delta-up'|'delta-down'|'delta-flat' }
 */
export function deltaArrow(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return { symbol: '—', cls: 'delta-flat' };
  if (c > p) return { symbol: '▲', cls: 'delta-up'   };
  if (c < p) return { symbol: '▼', cls: 'delta-down' };
  return { symbol: '—', cls: 'delta-flat' };
}
