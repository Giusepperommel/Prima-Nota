/**
 * Configurable CSV parser for bank statements.
 * Supports different column mappings for various Italian banks.
 */

export type ColumnMapping = {
  data: string;        // Column name for date
  descrizione: string; // Column name for description
  importo: string;     // Column name for amount (single column, signed)
  dare?: string;       // Column name for debit amount (separate columns)
  avere?: string;      // Column name for credit amount (separate columns)
  saldo?: string;      // Column name for balance
  riferimento?: string; // Column name for reference
};

export type MovimentoParsed = {
  data: Date;
  descrizione: string;
  importo: number;
  segno: "DARE" | "AVERE";
  saldo: number | null;
  riferimentoEsterno: string | null;
};

export type ParseResult = {
  movimenti: MovimentoParsed[];
  errori: { riga: number; messaggio: string }[];
};

// Common Italian bank CSV formats
export const PRESET_MAPPINGS: Record<string, ColumnMapping> = {
  GENERICO: {
    data: "Data",
    descrizione: "Descrizione",
    importo: "Importo",
    saldo: "Saldo",
    riferimento: "Riferimento",
  },
  INTESA_SANPAOLO: {
    data: "Data Operazione",
    descrizione: "Descrizione Operazione",
    dare: "Dare",
    avere: "Avere",
    saldo: "Saldo",
    importo: "",
  },
  UNICREDIT: {
    data: "Data Contabile",
    descrizione: "Causale",
    importo: "Importo",
    saldo: "Saldo Contabile",
    riferimento: "Riferimento",
  },
};

/**
 * Parse CSV content using the given column mapping.
 * Pure function, no DB dependency.
 */
export function parseCSV(
  csvContent: string,
  mapping: ColumnMapping,
  separator: string = ";",
): ParseResult {
  const movimenti: MovimentoParsed[] = [];
  const errori: { riga: number; messaggio: string }[] = [];

  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    return { movimenti: [], errori: [{ riga: 0, messaggio: "File vuoto o senza intestazione" }] };
  }

  // Parse header
  const headers = parseLine(lines[0], separator);
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => headerMap.set(h.trim(), i));

  // Helper to get column index
  const getCol = (name: string): number | undefined => {
    if (!name) return undefined;
    return headerMap.get(name);
  };

  const dataCol = getCol(mapping.data);
  const descCol = getCol(mapping.descrizione);
  const importoCol = getCol(mapping.importo);
  const dareCol = mapping.dare ? getCol(mapping.dare) : undefined;
  const avereCol = mapping.avere ? getCol(mapping.avere) : undefined;
  const saldoCol = mapping.saldo ? getCol(mapping.saldo) : undefined;
  const rifCol = mapping.riferimento ? getCol(mapping.riferimento) : undefined;

  if (dataCol === undefined) {
    errori.push({ riga: 0, messaggio: `Colonna "${mapping.data}" non trovata` });
    return { movimenti, errori };
  }
  if (descCol === undefined) {
    errori.push({ riga: 0, messaggio: `Colonna "${mapping.descrizione}" non trovata` });
    return { movimenti, errori };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseLine(line, separator);

    try {
      const dataStr = cols[dataCol]?.trim();
      if (!dataStr) {
        errori.push({ riga: i + 1, messaggio: "Data mancante" });
        continue;
      }

      const data = parseDate(dataStr);
      if (!data) {
        errori.push({ riga: i + 1, messaggio: `Data non valida: "${dataStr}"` });
        continue;
      }

      const descrizione = cols[descCol]?.trim() || "";

      let importo: number;
      let segno: "DARE" | "AVERE";

      if (dareCol !== undefined && avereCol !== undefined) {
        // Separate dare/avere columns
        const dare = parseAmount(cols[dareCol] || "");
        const avere = parseAmount(cols[avereCol] || "");
        if (dare > 0) {
          importo = dare;
          segno = "DARE";
        } else if (avere > 0) {
          importo = avere;
          segno = "AVERE";
        } else {
          errori.push({ riga: i + 1, messaggio: "Importo mancante (dare/avere)" });
          continue;
        }
      } else if (importoCol !== undefined) {
        const rawImporto = parseAmount(cols[importoCol] || "");
        if (rawImporto === 0 && !(cols[importoCol]?.trim() === "0" || cols[importoCol]?.trim() === "0,00")) {
          errori.push({ riga: i + 1, messaggio: "Importo non valido" });
          continue;
        }
        importo = Math.abs(rawImporto);
        segno = rawImporto >= 0 ? "AVERE" : "DARE";
      } else {
        errori.push({ riga: i + 1, messaggio: "Nessuna colonna importo configurata" });
        continue;
      }

      const saldo = saldoCol !== undefined ? parseAmount(cols[saldoCol] || "") || null : null;
      const riferimentoEsterno = rifCol !== undefined ? cols[rifCol]?.trim() || null : null;

      movimenti.push({ data, descrizione, importo, segno, saldo, riferimentoEsterno });
    } catch (e: any) {
      errori.push({ riga: i + 1, messaggio: e.message || "Errore di parsing" });
    }
  }

  return { movimenti, errori };
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
export function parseLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse an Italian-format date (dd/mm/yyyy or yyyy-mm-dd).
 */
export function parseDate(str: string): Date | null {
  // Try dd/mm/yyyy
  const dmyMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmyMatch) {
    const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Try yyyy-mm-dd
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const d = new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Parse an Italian-format amount (e.g., "1.234,56" or "-1234.56").
 */
export function parseAmount(str: string): number {
  if (!str || !str.trim()) return 0;
  let cleaned = str.trim();
  // Remove currency symbols
  cleaned = cleaned.replace(/[€$£\s]/g, "");
  // Italian format: 1.234,56 -> remove dots, replace comma with dot
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
