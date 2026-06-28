/**
 * filterEngine.js
 * Multi-choice categorical dropdown filters + fuzzy multi-field search.
 * All filtering runs on a plain array of rows; returns a filtered array.
 *
 * Each categorical filter holds a Set of selected values rather than a
 * single string — an empty Set means "no restriction" (show all), any
 * non-empty Set means "show rows whose value is one of these" (OR within
 * the field, AND across different fields), per the spec's "multi-choice
 * dropdown filters" requirement.
 */

// Active filter state: field -> Set<string> of selected values (empty = all)
let _filters = {
  project_status:  new Set(),
  automation_type: new Set(),
  country:         new Set(),
  industry:        new Set(),
};

let _searchQuery = '';

/** Fields searched by the fuzzy multi-field search */
const SEARCH_FIELDS = [
  'project_id', 'project_name', 'company_id',
  'country', 'industry', 'automation_type', 'project_status', 'implementation_partner',
];

export const FilterEngine = {
  /** Toggle a single value on/off within a categorical filter's selection set. */
  toggleFilterValue(field, value) {
    if (!_filters[field]) _filters[field] = new Set();
    if (_filters[field].has(value)) {
      _filters[field].delete(value);
    } else {
      _filters[field].add(value);
    }
  },

  /** Replace a filter's entire selection set (e.g. "select all" / "clear"). */
  setFilterValues(field, values) {
    _filters[field] = new Set(values);
  },

  isValueSelected(field, value) {
    return !!_filters[field] && _filters[field].has(value);
  },

  /** Number of values selected for a field (0 = unfiltered / "All"). */
  selectedCount(field) {
    return _filters[field] ? _filters[field].size : 0;
  },

  setSearch(query) {
    _searchQuery = query.trim().toLowerCase();
  },

  getFilters() {
    // Return plain arrays (not Sets) for safe external consumption.
    const out = {};
    for (const [field, set] of Object.entries(_filters)) out[field] = Array.from(set);
    return out;
  },
  getSearchQuery() { return _searchQuery; },

  /** Apply all active filters + search to an array of rows. Returns filtered array. */
  filter(rows) {
    return rows.filter(row => {
      // Categorical filters — empty set means unrestricted for that field;
      // non-empty set means the row's value must be one of the selected values.
      for (const [field, set] of Object.entries(_filters)) {
        if (set.size > 0 && !set.has(row[field])) return false;
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
    _filters = {
      project_status:  new Set(),
      automation_type: new Set(),
      country:         new Set(),
      industry:        new Set(),
    };
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
