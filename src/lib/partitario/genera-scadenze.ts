/**
 * Generates payment due dates (scadenze) from operations.
 * Supports standard Italian payment terms.
 */

export type TerminiPagamento =
  | "IMMEDIATO"       // Same day
  | "30GG"            // 30 days
  | "60GG"            // 60 days
  | "90GG"            // 90 days
  | "30_60GG"         // Split 50/50 at 30 and 60 days
  | "30_60_90GG"      // Split 33/33/34 at 30, 60, 90 days
  | "FINE_MESE"       // End of month
  | "FINE_MESE_30GG"; // End of month + 30 days

export type OperazionePerScadenza = {
  id: number;
  societaId: number;
  anagraficaId: number;
  dataOperazione: Date;
  importoTotale: number;
  tipoAnagrafica: "CLIENTE" | "FORNITORE";
};

export type ScadenzaGenerata = {
  societaId: number;
  anagraficaId: number;
  operazioneId: number;
  dataScadenza: Date;
  importo: number;
  tipo: "CLIENTE" | "FORNITORE";
};

/**
 * Generate due dates for a single operation based on payment terms.
 * Pure function, no DB dependency.
 */
export function generaScadenze(
  operazione: OperazionePerScadenza,
  termini: TerminiPagamento,
): ScadenzaGenerata[] {
  const { id, societaId, anagraficaId, dataOperazione, importoTotale, tipoAnagrafica } = operazione;
  const base = {
    societaId,
    anagraficaId,
    operazioneId: id,
    tipo: tipoAnagrafica,
  };

  switch (termini) {
    case "IMMEDIATO":
      return [{
        ...base,
        dataScadenza: new Date(dataOperazione),
        importo: importoTotale,
      }];

    case "30GG":
      return [{
        ...base,
        dataScadenza: addDays(dataOperazione, 30),
        importo: importoTotale,
      }];

    case "60GG":
      return [{
        ...base,
        dataScadenza: addDays(dataOperazione, 60),
        importo: importoTotale,
      }];

    case "90GG":
      return [{
        ...base,
        dataScadenza: addDays(dataOperazione, 90),
        importo: importoTotale,
      }];

    case "30_60GG": {
      const meta = Math.round(importoTotale * 50) / 100;
      return [
        { ...base, dataScadenza: addDays(dataOperazione, 30), importo: meta },
        { ...base, dataScadenza: addDays(dataOperazione, 60), importo: round2(importoTotale - meta) },
      ];
    }

    case "30_60_90GG": {
      const terzo = Math.round(importoTotale * 100 / 3) / 100;
      const resto = round2(importoTotale - terzo * 2);
      return [
        { ...base, dataScadenza: addDays(dataOperazione, 30), importo: terzo },
        { ...base, dataScadenza: addDays(dataOperazione, 60), importo: terzo },
        { ...base, dataScadenza: addDays(dataOperazione, 90), importo: resto },
      ];
    }

    case "FINE_MESE":
      return [{
        ...base,
        dataScadenza: endOfMonth(dataOperazione),
        importo: importoTotale,
      }];

    case "FINE_MESE_30GG":
      return [{
        ...base,
        dataScadenza: addDays(endOfMonth(dataOperazione), 30),
        importo: importoTotale,
      }];

    default:
      return [{
        ...base,
        dataScadenza: addDays(dataOperazione, 30),
        importo: importoTotale,
      }];
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
