/**
 * multiSelectFilter.js
 * Feature 7: Categorical Dropdown Filters — multi-choice.
 *
 * A lightweight checkbox-popover dropdown. Native <select multiple> was
 * deliberately avoided: it requires non-discoverable ctrl/cmd-click to
 * select more than one option and renders with un-themeable browser
 * chrome. This is a small from-scratch popover (no external dropdown
 * library), consistent with the project's "build it yourself" posture.
 *
 * Each instance is bound to one categorical field in FilterEngine and
 * renders as a button showing "All" or "N selected", which expands into
 * a checkbox list of every distinct value for that field.
 */

import { FilterEngine } from '../grid/filterEngine.js';

let _instances = [];

function _closeAllExcept(except) {
  for (const inst of _instances) {
    if (inst !== except) inst.popoverEl.classList.remove('open');
  }
}

export const MultiSelectFilter = {
  /**
   * Mount a multi-select filter into containerEl.
   * @param {HTMLElement} containerEl
   * @param {string} field      - the row field this filter targets
   * @param {string} label      - display label (e.g. "Status")
   * @param {string[]} options  - distinct values available for this field
   * @param {function} onChange - called after any selection change
   */
  mount(containerEl, field, label, options, onChange) {
    containerEl.innerHTML = `
      <div class="ms-filter">
        <button type="button" class="ms-filter-btn" id="ms-btn-${field}">
          <span class="ms-filter-label">${label}</span>
          <span class="ms-filter-count" id="ms-count-${field}">All</span>
          <span class="ms-filter-caret">▾</span>
        </button>
        <div class="ms-filter-popover" id="ms-pop-${field}">
          <div class="ms-filter-actions">
            <button type="button" class="ms-filter-action" id="ms-all-${field}">Select all</button>
            <button type="button" class="ms-filter-action" id="ms-none-${field}">Clear</button>
          </div>
          <div class="ms-filter-options" id="ms-opts-${field}"></div>
        </div>
      </div>
    `;

    const btnEl  = document.getElementById(`ms-btn-${field}`);
    const popEl  = document.getElementById(`ms-pop-${field}`);
    const optsEl = document.getElementById(`ms-opts-${field}`);
    const countEl= document.getElementById(`ms-count-${field}`);

    // Remove any previous instance for this field (e.g. if mount() is ever
    // called again for the same container) so _instances never accumulates
    // stale entries pointing at detached DOM nodes.
    _instances = _instances.filter(inst => inst.field !== field);

    function _renderOptions() {
      optsEl.innerHTML = options.map(opt => {
        const checked = FilterEngine.isValueSelected(field, opt) ? 'checked' : '';
        const safeId = `ms-opt-${field}-${opt.replace(/[^a-z0-9]/gi, '_')}`;
        return `
          <label class="ms-filter-option" for="${safeId}">
            <input type="checkbox" id="${safeId}" value="${opt}" ${checked} />
            <span>${opt}</span>
          </label>`;
      }).join('');

      optsEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          FilterEngine.toggleFilterValue(field, cb.value);
          _updateCount();
          onChange();
        });
      });
    }

    function _updateCount() {
      const n = FilterEngine.selectedCount(field);
      countEl.textContent = n === 0 ? 'All' : `${n} selected`;
      btnEl.classList.toggle('ms-filter-active', n > 0);
    }

    const instance = {
      field,
      popoverEl: popEl,
      refresh: () => { _renderOptions(); _updateCount(); },
      clear: () => {
        FilterEngine.setFilterValues(field, []);
        _renderOptions();
        _updateCount();
      },
    };
    _instances.push(instance);

    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !popEl.classList.contains('open');
      _closeAllExcept(instance);
      popEl.classList.toggle('open', willOpen);
    });

    document.getElementById(`ms-all-${field}`).addEventListener('click', () => {
      FilterEngine.setFilterValues(field, options);
      _renderOptions();
      _updateCount();
      onChange();
    });

    document.getElementById(`ms-none-${field}`).addEventListener('click', () => {
      FilterEngine.setFilterValues(field, []);
      _renderOptions();
      _updateCount();
      onChange();
    });

    _renderOptions();
    _updateCount();

    return instance;
  },

  /** Clear every mounted instance's selection (used by the global "Clear" button). */
  clearAllInstances() {
    for (const inst of _instances) {
      if (inst.clear) inst.clear();
    }
  },
};

// Close any open popover when clicking outside — registered once globally.
document.addEventListener('click', () => _closeAllExcept(null));
