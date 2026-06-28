/**
 * csvLoader.js
 * Lightweight CSV parser — no PapaParse dependency.
 * Fetches automation_projects.csv and returns an array of typed row objects.
 */

/** Parse a CSV string into an array of objects (first row = headers). */
function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields with commas inside
    const values = [];
    let inQuote = false;
    let cur = '';
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim());

    if (values.length !== headers.length) continue;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const raw = values[j];
      // Coerce numeric-looking fields
      const num = Number(raw);
      row[key] = raw !== '' && !isNaN(num) ? num : raw;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Load and parse the CSV file.
 * @param {string} [path='./automation_projects.csv']
 * @returns {Promise<Array>}
 */
export async function loadCSV(path = './automation_projects.csv') {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  const text = await response.text();
  return parseCSV(text);
}
