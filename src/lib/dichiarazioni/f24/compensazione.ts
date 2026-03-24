/**
 * F24 credit compensation logic.
 * Handles horizontal compensation (crediti vs debiti di tributi diversi).
 * Pure function — no DB access.
 */

import {
  type RigaF24,
  type CreditoDisponibile,
  LIMITE_COMPENSAZIONE_ANNUO,
  SOGLIA_VISTO_IVA,
} from "./f24-types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RisultatoCompensazione = {
  righe: RigaF24[];
  creditiResidui: CreditoDisponibile[];
  totaleCompensato: number;
  errori: string[];
};

/**
 * Applies credit compensation to F24 rows.
 * Returns updated rows with importoCredito filled where applicable.
 *
 * Rules:
 * - Maximum annual compensation: 2M EUR
 * - IVA credit > 5000 requires visto di conformita
 * - Credits are applied proportionally across debit rows
 */
export function applicaCompensazione(
  righe: RigaF24[],
  crediti: CreditoDisponibile[],
): RigaF24[] {
  if (!crediti.length) return righe;

  const result = righe.map((r) => ({ ...r }));

  // Calculate total debit
  const totaleDebito = result.reduce((sum, r) => sum + r.importoDebito, 0);
  if (totaleDebito <= 0) return result;

  // Calculate total available credit
  let creditoDisponibile = 0;
  for (const c of crediti) {
    if (c.tipo === "IVA" && c.importo > SOGLIA_VISTO_IVA && !c.richiedeVisto) {
      // Skip IVA credits > 5000 without visto
      continue;
    }
    creditoDisponibile += c.importo;
  }

  // Cap at annual limit
  creditoDisponibile = Math.min(creditoDisponibile, LIMITE_COMPENSAZIONE_ANNUO);

  // Cap at total debit (can't compensate more than owed)
  const compensazioneDaApplicare = Math.min(creditoDisponibile, totaleDebito);

  if (compensazioneDaApplicare <= 0) return result;

  // Apply compensation: add a credit row for each credit type used
  let compensazioneResidua = compensazioneDaApplicare;
  for (const credito of crediti) {
    if (compensazioneResidua <= 0) break;

    if (credito.tipo === "IVA" && credito.importo > SOGLIA_VISTO_IVA && !credito.richiedeVisto) {
      continue;
    }

    const importoDaUsare = round2(Math.min(credito.importo, compensazioneResidua));
    if (importoDaUsare <= 0) continue;

    // Map credit type to codice tributo
    const codiceTributo = credito.tipo === "IVA" ? "6099"
      : credito.tipo === "IRES" ? "2003"
        : "3800"; // IRAP

    const sezione = credito.tipo === "IRAP" ? "REGIONI_ENTI_LOCALI" as const : "ERARIO" as const;

    result.push({
      sezione,
      codiceTributo,
      annoRiferimento: credito.annoOrigine,
      importoDebito: 0,
      importoCredito: importoDaUsare,
      descrizione: `Compensazione credito ${credito.tipo} anno ${credito.annoOrigine}`,
    });

    compensazioneResidua = round2(compensazioneResidua - importoDaUsare);
  }

  return result;
}

/**
 * Validates compensation request.
 * Returns list of errors, empty if all valid.
 */
export function validaCompensazione(
  crediti: CreditoDisponibile[],
  compensazioneGiaUsataAnno: number,
): string[] {
  const errori: string[] = [];

  const totaleCrediti = crediti.reduce((sum, c) => sum + c.importo, 0);

  if (compensazioneGiaUsataAnno + totaleCrediti > LIMITE_COMPENSAZIONE_ANNUO) {
    errori.push(
      `Superato limite annuo compensazione: gia utilizzati ${compensazioneGiaUsataAnno.toLocaleString("it-IT")} EUR, ` +
      `richiesti ${totaleCrediti.toLocaleString("it-IT")} EUR, limite ${LIMITE_COMPENSAZIONE_ANNUO.toLocaleString("it-IT")} EUR`,
    );
  }

  for (const c of crediti) {
    if (c.tipo === "IVA" && c.importo > SOGLIA_VISTO_IVA && !c.richiedeVisto) {
      errori.push(
        `Credito IVA di ${c.importo.toLocaleString("it-IT")} EUR richiede visto di conformita (soglia ${SOGLIA_VISTO_IVA.toLocaleString("it-IT")} EUR)`,
      );
    }
    if (c.importo <= 0) {
      errori.push(`Credito ${c.tipo} con importo non positivo: ${c.importo}`);
    }
  }

  return errori;
}

/**
 * Calculates how much compensation capacity remains for the year.
 */
export function capacitaCompensazioneResidua(compensazioneGiaUsataAnno: number): number {
  return round2(Math.max(0, LIMITE_COMPENSAZIONE_ANNUO - compensazioneGiaUsataAnno));
}
