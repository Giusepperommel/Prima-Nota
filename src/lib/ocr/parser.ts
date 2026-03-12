import type { ParsedDocument } from "./types";

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
