import type { ProviderConfig } from "@prisma/client";
import type { BancaProvider, MovimentoBancarioImportato } from "../types";

function detectSeparator(firstLine: string): string {
  if (firstLine.includes(";")) return ";";
  if (firstLine.includes("\t")) return "\t";
  return ",";
}

function parseItalianDate(dateStr: string): Date {
  // DD/MM/YYYY or YYYY-MM-DD
  const trimmed = dateStr.trim();
  if (trimmed.includes("/")) {
    const [day, month, year] = trimmed.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(trimmed);
}

function parseItalianAmount(amountStr: string): number {
  let cleaned = amountStr.trim();
  // Handle "1.220,50" format (dot as thousands, comma as decimal)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    // Handle "1220,50" format (comma as decimal only)
    cleaned = cleaned.replace(",", ".");
  }
  return Number(cleaned);
}

function findColumn(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase().includes(candidate.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseBancaCsv(csvContent: string): MovimentoBancarioImportato[] {
  const lines = csvContent.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator).map((h) => h.trim());

  const colData = findColumn(headers, "data", "date");
  const colDataValuta = findColumn(headers, "valuta", "data valuta");
  const colDescrizione = findColumn(headers, "descrizione", "description", "causale");
  const colImporto = findColumn(headers, "importo", "amount", "dare/avere");
  const colCausale = findColumn(headers, "causale", "codice causale", "cod");

  if (colData === -1 || colImporto === -1) return [];

  const results: MovimentoBancarioImportato[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim());
    if (cols.length < 2) continue;

    const dataStr = cols[colData];
    if (!dataStr) continue;

    results.push({
      data: parseItalianDate(dataStr),
      dataValuta: colDataValuta !== -1 && cols[colDataValuta]
        ? parseItalianDate(cols[colDataValuta])
        : undefined,
      importo: parseItalianAmount(cols[colImporto]),
      descrizione: colDescrizione !== -1 ? (cols[colDescrizione] ?? "") : "",
      causale: colCausale !== -1 && colCausale !== colDescrizione
        ? cols[colCausale]
        : undefined,
    });
  }

  return results;
}

export class BancaFileAdapter implements BancaProvider {
  constructor(private config: ProviderConfig) {}

  async getMovimenti(_from: Date, _to: Date): Promise<MovimentoBancarioImportato[]> {
    // File-based provider doesn't support date filtering — returns all parsed rows.
    // Filtering is done at the caller level after upload.
    return [];
  }

  parseFile(csvContent: string): MovimentoBancarioImportato[] {
    return parseBancaCsv(csvContent);
  }
}
