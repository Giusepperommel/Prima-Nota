/**
 * Types for IVA liquidation calculation engine.
 * Maps to VP fields in the LIPE declaration.
 */

export interface CalcoloLiquidazioneInput {
  societaId: number;
  tipo: "MENSILE" | "TRIMESTRALE";
  periodo: number; // 1-12 for mensile, 1-4 for trimestrale
  anno: number;
}

export interface CalcoloLiquidazioneResult {
  totaleOperazioniAttive: number;   // VP2: imponibile vendite + non imponibili + esenti
  totaleOperazioniPassive: number;  // VP3: imponibile acquisti + non imponibili + esenti
  ivaEsigibile: number;            // VP4: IVA sulle vendite
  ivaDetraibile: number;           // VP5: IVA sugli acquisti detraibile
  saldo: number;                   // VP6: VP4 - VP5 (positive=debito, negative=credito)
  debitoPeriodoPrecedente: number;  // VP7: debito < 25.82 non versato
  creditoPeriodoPrecedente: number; // VP8: credito periodo precedente
  creditoAnnoPrecedente: number;    // VP9: credito da dichiarazione anno precedente
  versamentiAutoUE: number;        // VP10
  creditiImposta: number;          // VP11
  interessiDovuti: number;         // VP12: 1% maggiorazione trimestrali
  accontoVersato: number;          // VP13
  importoFinale: number;           // VP14: positive=versare, negative=credito
  codiceTributo: string;
}

export interface AccontoIvaInput {
  societaId: number;
  anno: number;
  metodo?: 1 | 2 | 3; // 1=storico, 2=previsionale, 3=analitico
  importoPrevisionale?: number; // only for metodo 2
}

export interface AccontoIvaResult {
  importo: number;
  dovuto: boolean;
  metodo: 1 | 2 | 3;
  baseCalcolo: number;
}

/**
 * Threshold below which IVA debt is carried forward instead of being paid.
 */
export const SOGLIA_VERSAMENTO_MINIMO = 25.82;

/**
 * Threshold below which acconto IVA is not due.
 */
export const SOGLIA_ACCONTO_MINIMO = 103.29;

/**
 * Percentage for quarterly surcharge (1%).
 */
export const MAGGIORAZIONE_TRIMESTRALE = 0.01;

/**
 * Percentage for acconto storico (88%).
 */
export const PERCENTUALE_ACCONTO = 0.88;
