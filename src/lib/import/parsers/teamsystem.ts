import type { ParsedRow } from "../import-types";

/**
 * Parses TeamSystem semicolon-separated CSV into ParsedRow[].
 * Handles quoted fields (including semicolons within quotes)
 * and escaped quotes ("" inside quoted fields).
 */
export function parseTeamSystemCsv(csv: string): ParsedRow[] {
  const lines = splitCsvLines(csv);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const values = parseCsvLine(line);
    const data: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      data[headers[j]] = values[j] ?? "";
    }

    rows.push({
      rowNumber: i,
      data,
    });
  }

  return rows;
}

/**
 * Splits CSV text into lines, respecting quoted fields that span multiple lines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++; // skip \n in \r\n
      }
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Parses a single CSV line with semicolon separator and quote handling.
 * Escaped quotes within quoted fields are represented as "".
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ";") {
        fields.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}
