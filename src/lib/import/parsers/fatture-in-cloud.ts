import type { ParsedRow } from "../import-types";

/**
 * Parses Fatture in Cloud comma-separated CSV into ParsedRow[].
 * Handles quoted fields (including commas within quotes)
 * and escaped quotes ("" inside quoted fields).
 */
export function parseFattureInCloudCsv(csvContent: string): ParsedRow[] {
  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0], ",");

  return lines.slice(1).map((line, i) => {
    const values = parseCsvLine(line, ",");
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      data[h] = values[idx] || "";
    });
    return { rowNumber: i + 1, data };
  });
}

function parseCsvLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
