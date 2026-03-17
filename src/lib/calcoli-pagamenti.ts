/**
 * Payment plan calculation utilities.
 * Generates installment schedules (piano rate) with dates,
 * capital/interest split, and validation for custom payments.
 */

import { addMonths } from "date-fns";
import { calcolaPianoFinanziamento } from "./calcoli-veicoli";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RataPagamento = {
  numeroPagamento: number;
  data: Date;
  importo: number;
  quotaCapitale: number;
  quotaInteressi: number;
};

export type PianoPagamentoGenerato = {
  rate: RataPagamento[];
  totaleInteressi: number;
  totaleCapitale: number;
  importoRata: number;
};

// ---------------------------------------------------------------------------
// Schedule generation
// ---------------------------------------------------------------------------

/**
 * Generates a full installment payment schedule with dates.
 * Reuses calcolaPianoFinanziamento from calcoli-veicoli.ts for the
 * French amortization math, then adds date assignment.
 */
export function generaPianoPagamento(
  importoDaFinanziare: number,
  numeroRate: number,
  tan: number | null | undefined,
  dataInizio: Date
): PianoPagamentoGenerato {
  if (numeroRate <= 0 || importoDaFinanziare <= 0) {
    return { rate: [], totaleInteressi: 0, totaleCapitale: 0, importoRata: 0 };
  }

  const haInteressi = tan != null && tan > 0;
  let importoRata: number;
  if (haInteressi) {
    const tassoMensile = tan / 100 / 12;
    const factor = Math.pow(1 + tassoMensile, numeroRate);
    importoRata = Math.round(
      (importoDaFinanziare * (tassoMensile * factor) / (factor - 1)) * 100
    ) / 100;
  } else {
    importoRata = Math.round((importoDaFinanziare / numeroRate) * 100) / 100;
  }

  // Reuse existing amortization logic
  const pianoFin = calcolaPianoFinanziamento(importoDaFinanziare, numeroRate, importoRata, tan);

  // Add dates
  const rate: RataPagamento[] = pianoFin.map((r) => ({
    numeroPagamento: r.numeroRata,
    data: addMonths(dataInizio, r.numeroRata - 1),
    importo: r.importoRata,
    quotaCapitale: r.quotaCapitale,
    quotaInteressi: r.quotaInteressi,
  }));

  const totaleInteressi = Math.round(
    rate.reduce((sum, r) => sum + r.quotaInteressi, 0) * 100
  ) / 100;

  return {
    rate,
    totaleInteressi,
    totaleCapitale: importoDaFinanziare,
    importoRata,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that custom payment amounts don't exceed the operation total.
 */
export function validaPagamentiCustom(
  importoTotaleOperazione: number,
  pagamenti: { importo: number }[]
): { copertura: number; rimanente: number; superato: boolean } {
  const copertura = pagamenti.reduce((sum, p) => sum + p.importo, 0);
  const rimanente = Math.round((importoTotaleOperazione - copertura) * 100) / 100;
  return {
    copertura: Math.round(copertura * 100) / 100,
    rimanente,
    superato: rimanente < 0,
  };
}
