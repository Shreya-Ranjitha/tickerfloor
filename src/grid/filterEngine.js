/**
 * filterEngine.js
 * Categorical dropdown filters + fuzzy multi-field search.
 * All filtering runs on a plain array of rows; returns a filtered array.
 */

// Active filter state
let _filters = {
  project_status:  '',   // '' = all
  automation_type: '',
  country:         '',
  industry:        '',
};

let _searchQuery = '';

/** Fields searched by the fuzzy multi-field search */
const SEARCH_FIELDS = [
  'project_id', 'project_name', 'company_name',
  'country', 'industry', 'automation_type', 'project_status',
];

export const FilterEngine = {
  setFilter(field, value) {
    _filters[field] = value;
  },

  setSearch(query) {
    _searchQuery = query.trim().toLowerCase();
  },

  getFilters()     { return { ..._filters }; },
  getSearchQuery() { return _searchQuery; },

  /** Apply all active filters + search to an array of rows. Returns filtered array. */
  filter(rows) {
    return rows.filter(row => {
      // Categorical filters
      for (const [field, value] of Object.entries(_filters)) {
        if (value && row[field] !== value) return false;
      }

      // Fuzzy multi-field search
      if (_searchQuery) {
        const terms = _searchQuery.split(/\s+/).filter(Boolean);
        const haystack = SEARCH_FIELDS.map(f => (row[f] ?? '').toString().toLowerCase()).join(' ');
        for (const term of terms) {
          if (!haystack.includes(term)) return false;
        }
      }

      return true;
    });
  },

  clearAll() {
    _filters = { project_status: '', automation_type: '', country: '', industry: '' };
    _searchQuery = '';
  },

  /** Build unique sorted option lists for each categorical filter from a row array */
  buildOptions(rows) {
    const sets = {
      project_status:  new Set(),
      automation_type: new Set(),
      country:         new Set(),
      industry:        new Set(),
    };
    for (const row of rows) {
      for (const field of Object.keys(sets)) {
        if (row[field]) sets[field].add(row[field]);
      }
    }
    const result = {};
    for (const [field, set] of Object.entries(sets)) {
      result[field] = Array.from(set).sort();
    }
    return result;
  },
};
