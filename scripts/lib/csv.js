/**
 * Minimal RFC-4180 style CSV parser.
 *
 * Supports: quoted fields, escaped double quotes ("") inside quoted fields,
 * commas and newlines (LF or CRLF) inside quoted fields, and a header row.
 * No runtime dependencies.
 */

/**
 * Parse raw CSV text into an array of row arrays (arrays of string fields).
 *
 * @param {string} text raw CSV content
 * @returns {string[][]} rows, each an array of field strings
 */
export function parseRows(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += 2;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }

  if (inQuotes) {
    throw new Error("csv: unterminated quoted field");
  }

  // Flush the final row unless the text ended with a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse CSV text that has a header row.
 *
 * @param {string} text raw CSV content
 * @returns {{ header: string[], rows: Record<string, string>[] }}
 *   header: the header field names in order;
 *   rows: one object per data row keyed by header name.
 */
export function parse(text) {
  const allRows = parseRows(text);
  if (allRows.length === 0) {
    throw new Error("csv: empty input, expected a header row");
  }
  const header = allRows[0];
  const rows = allRows.slice(1).map((fields) => {
    const record = {};
    for (let c = 0; c < header.length; c += 1) {
      record[header[c]] = c < fields.length ? fields[c] : "";
    }
    return record;
  });
  return { header, rows };
}
