import type { ParsedDocument, ParsedTransaction } from "./types";

function parseImportoItaliano(raw: string): number | null {
  const cleaned = raw.replace(/[€\s]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function parseDataItaliana(raw: string): string | null {
  const match = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return null;
  const d = day.padStart(2, "0");
  const m = month.padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function parseDocumentText(text: string): ParsedDocument {
  const result: ParsedDocument = {
    dataOperazione: null,
    numeroDocumento: null,
    descrizione: null,
    importoTotale: null,
    imponibile: null,
    aliquotaIva: null,
    importoIva: null,
    tipoOperazione: null,
    fornitore: null,
  };

  // --- Data ---
  const dataPatterns = [
    /(?:data|del|in data|emessa il|data fattura)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
  ];
  for (const pattern of dataPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.dataOperazione = parseDataItaliana(match[1]);
      if (result.dataOperazione) break;
    }
  }

  // --- Numero documento ---
  const numDocPatterns = [
    /(?:fattura|fatt\.|documento|doc\.|ricevuta|nota)\s*(?:n\.|n°|nr\.?|numero)?\s*[:\s]*([A-Za-z0-9\/\-]+)/i,
    /(?:n\.|n°|nr\.?)\s*([A-Za-z0-9\/\-]+)/i,
  ];
  for (const pattern of numDocPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.numeroDocumento = match[1].trim();
      break;
    }
  }

  // --- Importi ---
  const totaleMatches = text.matchAll(
    /(?:totale\s*(?:documento|fattura|da pagare|generale|complessivo)?)[:\s]*€?\s*([\d.,]+)/gi
  );
  const totali = [...totaleMatches];
  if (totali.length > 0) {
    const lastTotale = totali[totali.length - 1];
    result.importoTotale = parseImportoItaliano(lastTotale[1]);
  }

  const imponibileMatch = text.match(
    /(?:imponibile|base imponibile|totale imponibile)[:\s]*€?\s*([\d.,]+)/i
  );
  if (imponibileMatch) {
    result.imponibile = parseImportoItaliano(imponibileMatch[1]);
  }

  const importoIvaMatch = text.match(
    /(?:iva|imposta)[:\s]*(?:\d+%?\s*)?€?\s*([\d.,]+)/i
  );
  if (importoIvaMatch) {
    result.importoIva = parseImportoItaliano(importoIvaMatch[1]);
  }

  // --- Aliquota IVA ---
  const aliquotaMatch = text.match(/(?:iva|aliquota)[:\s]*(?:al\s*)?(\d{1,2})\s*%/i);
  if (aliquotaMatch) {
    const aliquota = aliquotaMatch[1];
    if (["4", "5", "10", "22"].includes(aliquota)) {
      result.aliquotaIva = aliquota;
    }
  }

  // --- Fornitore ---
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(line)) continue;
    if (/^(fattura|ricevuta|nota|documento|data|totale|iva)/i.test(line)) continue;
    if (/^\d+[,.]?\d*$/.test(line)) continue;
    if (line.length < 3) continue;
    result.fornitore = line;
    break;
  }

  // --- Descrizione ---
  if (result.fornitore || result.numeroDocumento) {
    const parts: string[] = [];
    if (result.numeroDocumento) parts.push(`Fatt. ${result.numeroDocumento}`);
    if (result.fornitore) parts.push(result.fornitore);
    result.descrizione = parts.join(" - ");
  }

  // --- Importo generico fallback ---
  if (result.importoTotale === null) {
    const importoGenerico = text.match(/€\s*([\d.,]+)/);
    if (importoGenerico) {
      result.importoTotale = parseImportoItaliano(importoGenerico[1]);
    }
  }

  // --- Tipo operazione ---
  if (result.importoTotale !== null || result.descrizione) {
    result.tipoOperazione = "COSTO";
  }

  return result;
}

/**
 * Tries to parse OCR text as a bank statement with multiple rows.
 * Returns array of transactions if detected, null otherwise.
 *
 * Bank statements typically have rows with: date, description, amount
 * Pattern per line: DD/MM/YYYY ... amount (with €, or negative sign, or comma)
 */
export function parseMultipleTransactions(text: string): ParsedTransaction[] | null {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const transactions: ParsedTransaction[] = [];

  // Look for lines that start with a date pattern DD/MM/YYYY
  const dateLineRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(dateLineRegex);

    if (dateMatch) {
      const dataIso = parseDataItaliana(dateMatch[1]);

      // Collect text from this line and possibly next lines until we find an amount
      // or another date line
      let fullText = line.substring(dateMatch[0].length).trim();
      let importo: number | null = null;

      // Try to find amount in current line
      importo = extractAmountFromLine(fullText);

      // If no amount found, check next lines (bank statements sometimes wrap)
      if (importo === null) {
        let j = i + 1;
        while (j < lines.length && j <= i + 3) {
          const nextLine = lines[j];
          // Stop if we hit another date line
          if (dateLineRegex.test(nextLine)) break;

          fullText += " " + nextLine;
          importo = extractAmountFromLine(nextLine);
          if (importo !== null) {
            j++;
            break;
          }
          j++;
        }
        i = j;
      } else {
        i++;
      }

      if (importo !== null) {
        // Clean description: remove the amount pattern and common noise
        let descrizione = fullText
          .replace(/[-+]?\s*[\d.,]+\s*€/g, "")
          .replace(/€\s*[-+]?\s*[\d.,]+/g, "")
          .replace(/[-]\s*[\d.]+,\d{2}\s*$/g, "")
          .replace(/\s+/g, " ")
          .trim();

        // Remove a second date if present (data valuta)
        descrizione = descrizione.replace(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\s*/, "").trim();
        // Remove trailing dash
        descrizione = descrizione.replace(/\s*-\s*$/, "").trim();

        if (descrizione.length > 0) {
          transactions.push({
            dataOperazione: dataIso,
            descrizione,
            importoTotale: Math.abs(importo), // Always positive, costs are always positive in the app
          });
        }
      }
    } else {
      i++;
    }
  }

  // Only return if we found at least 2 transactions (otherwise it's a single document)
  return transactions.length >= 2 ? transactions : null;
}

function extractAmountFromLine(text: string): number | null {
  // Match patterns like: - 1.234,56 €  or  € 1.234,56  or  -1234,56  or  1.087,00 €
  const patterns = [
    /[-+]?\s*([\d.]+,\d{2})\s*€/,
    /€\s*[-+]?\s*([\d.]+,\d{2})/,
    /[-]\s*([\d.]+,\d{2})\s*$/,
    /([\d.]+,\d{2})\s*€/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseImportoItaliano(match[1]);
    }
  }
  return null;
}
