/**
 * layoutPersistence.js
 * localStorage-backed panel visibility toggles — Feature 6.
 * Persists which side panels the user has enabled across sessions.
 */

const STORAGE_KEY = 'rfx_layout_v1';

const PANELS = [
  { id: 'panel-crash-feed', label: 'Crash Feed',     defaultVisible: true  },
  { id: 'panel-ticker-tape',label: 'Ticker Tape',    defaultVisible: true  },
  { id: 'panel-kpi-bar',    label: 'RFX Index Bar',  defaultVisible: true  },
];

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function _applyVisibility(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

export const LayoutPersistence = {
  mount(containerEl) {
    let state = _load() || {};
    // Ensure all panels have a default
    for (const p of PANELS) {
      if (state[p.id] === undefined) state[p.id] = p.defaultVisible;
    }
    _save(state);

    // Apply initial visibility
    for (const p of PANELS) _applyVisibility(p.id, state[p.id]);

    // Build checkboxes
    containerEl.innerHTML = PANELS.map(p => `
      <label class="layout-toggle">
        <input type="checkbox" data-panel="${p.id}" ${state[p.id] ? 'checked' : ''}>
        ${p.label}
      </label>
    `).join('');

    containerEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.panel;
        state[id] = cb.checked;
        _applyVisibility(id, cb.checked);
        _save(state);
      });
    });
  },
};
