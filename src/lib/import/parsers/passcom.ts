import type { ParsedRow } from "../import-types";
import { parseTeamSystemCsv } from "./teamsystem";

/**
 * Parses Passcom semicolon-separated CSV into ParsedRow[].
 * Passcom uses the same semicolon-separated CSV format as TeamSystem.
 */
export function parsePasscomCsv(csvContent: string): ParsedRow[] {
  return parseTeamSystemCsv(csvContent);
}
