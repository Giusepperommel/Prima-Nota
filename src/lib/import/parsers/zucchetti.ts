import type { ParsedRow } from "../import-types";

/**
 * Parses Zucchetti pipe-separated CSV into ParsedRow[].
 * Zucchetti exports use `|` as field separator.
 */
export function parseZucchettiCsv(csvContent: string): ParsedRow[] {
  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split("|").map((h) => h.trim());

  return lines.slice(1).map((line, i) => {
    const values = line.split("|").map((v) => v.trim());
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      data[h] = values[idx] || "";
    });
    return { rowNumber: i + 1, data };
  });
}
