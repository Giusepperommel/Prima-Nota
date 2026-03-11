/**
 * Fiscal calculation utilities for vehicle purchases.
 * Art. 164 TUIR - Italian tax rules for business vehicles.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TipoVeicolo = "AUTOVETTURA" | "MOTOCICLO" | "CICLOMOTORE" | "AUTOCARRO";
export type UsoVeicolo = "PROMISCUO" | "STRUMENTALE_ESCLUSIVO" | "USO_DIPENDENTE" | "AGENTE_COMMERCIO";

// ---------------------------------------------------------------------------
// Fiscal limits per vehicle type (art. 164 TUIR)
// ---------------------------------------------------------------------------

export const LIMITI_FISCALI_VEICOLO: Record<TipoVeicolo, { standard: number; agente: number }> = {
  AUTOVETTURA: { standard: 18075.99, agente: 25822.84 },
  MOTOCICLO: { standard: 4131.66, agente: 4131.66 },
  CICLOMOTORE: { standard: 2065.83, agente: 2065.83 },
  AUTOCARRO: { standard: Infinity, agente: Infinity },
};

// ---------------------------------------------------------------------------
// Deductibility and VAT percentages per usage type
// ---------------------------------------------------------------------------

export const PERCENTUALI_USO: Record<UsoVeicolo, { deducibilita: number; detraibilitaIva: number }> = {
  PROMISCUO: { deducibilita: 20, detraibilitaIva: 40 },
  STRUMENTALE_ESCLUSIVO: { deducibilita: 100, detraibilitaIva: 100 },
  USO_DIPENDENTE: { deducibilita: 70, detraibilitaIva: 40 },
  AGENTE_COMMERCIO: { deducibilita: 80, detraibilitaIva: 100 },
};

// ---------------------------------------------------------------------------
// Get fiscal limit for a vehicle
// ---------------------------------------------------------------------------

/**
 * Returns the fiscal limit for depreciation base, given vehicle type and usage.
 * AUTOCARRO strumentale has no limit (returns Infinity).
 * AGENTE_COMMERCIO gets higher limits for AUTOVETTURA.
 */
export function getLimiteFiscale(
  tipoVeicolo: TipoVeicolo,
  usoVeicolo: UsoVeicolo
): number {
  const limiti = LIMITI_FISCALI_VEICOLO[tipoVeicolo];
  if (usoVeicolo === "AGENTE_COMMERCIO") return limiti.agente;
  if (usoVeicolo === "STRUMENTALE_ESCLUSIVO") return Infinity;
  return limiti.standard;
}

/**
 * Returns the deductibility and VAT deductibility percentages for the given usage.
 */
export function getPercentualiUso(usoVeicolo: UsoVeicolo): {
  deducibilita: number;
  detraibilitaIva: number;
} {
  return PERCENTUALI_USO[usoVeicolo];
}

// ---------------------------------------------------------------------------
// Depreciation base calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the fiscal depreciation base for a vehicle.
 * Base = min(costo + IVA indetraibile, limite fiscale)
 *
 * @param costoAcquisto - Purchase price (net of VAT)
 * @param ivaIndetraibile - Non-deductible VAT amount (gets capitalized)
 * @param limiteFiscale - Fiscal limit for this vehicle type+usage
 * @returns The fiscal base for depreciation calculation
 */
export function calcolaBaseFiscale(
  costoAcquisto: number,
  ivaIndetraibile: number,
  limiteFiscale: number
): number {
  const valoreContabile = costoAcquisto + ivaIndetraibile;
  return Math.min(valoreContabile, limiteFiscale);
}

// ---------------------------------------------------------------------------
// Financing calculations
// ---------------------------------------------------------------------------

export type PianoRataFinanziamento = {
  numeroRata: number;
  quotaCapitale: number;
  quotaInteressi: number;
  importoRata: number;
  debitoResiduo: number;
};

/**
 * Generates the financing amortization schedule (piano ammortamento finanziamento).
 *
 * With TAN: French amortization (constant installment, decreasing interest).
 * Without TAN: Linear interest distribution (total interest split evenly).
 *
 * @param importoFinanziato - Amount financed
 * @param numeroRate - Number of installments
 * @param importoRata - Monthly installment amount
 * @param tan - Optional annual nominal rate (percentage, e.g. 5.5 for 5.5%)
 */
export function calcolaPianoFinanziamento(
  importoFinanziato: number,
  numeroRate: number,
  importoRata: number,
  tan?: number | null
): PianoRataFinanziamento[] {
  const piano: PianoRataFinanziamento[] = [];

  if (tan != null && tan > 0) {
    // French amortization with TAN
    const tassoMensile = tan / 100 / 12;
    let debitoResiduo = importoFinanziato;

    for (let i = 1; i <= numeroRate; i++) {
      const quotaInteressi = Math.round(debitoResiduo * tassoMensile * 100) / 100;
      let quotaCapitale = Math.round((importoRata - quotaInteressi) * 100) / 100;

      // Last installment: adjust to close debt exactly
      if (i === numeroRate) {
        quotaCapitale = Math.round(debitoResiduo * 100) / 100;
        const rataEffettiva = Math.round((quotaCapitale + quotaInteressi) * 100) / 100;
        debitoResiduo = 0;
        piano.push({
          numeroRata: i,
          quotaCapitale,
          quotaInteressi,
          importoRata: rataEffettiva,
          debitoResiduo: 0,
        });
      } else {
        debitoResiduo = Math.round((debitoResiduo - quotaCapitale) * 100) / 100;
        piano.push({
          numeroRata: i,
          quotaCapitale,
          quotaInteressi,
          importoRata,
          debitoResiduo,
        });
      }
    }
  } else {
    // Linear interest distribution (no TAN)
    const totaleRate = Math.round(importoRata * numeroRate * 100) / 100;
    const totaleInteressi = Math.round((totaleRate - importoFinanziato) * 100) / 100;
    const interessePerRata = Math.round((totaleInteressi / numeroRate) * 100) / 100;
    const capitalePerRata = Math.round((importoFinanziato / numeroRate) * 100) / 100;

    let debitoResiduo = importoFinanziato;
    for (let i = 1; i <= numeroRate; i++) {
      let quotaCapitale = capitalePerRata;
      let quotaInteressi = interessePerRata;

      // Last installment: adjust to close residuals
      if (i === numeroRate) {
        quotaCapitale = Math.round(debitoResiduo * 100) / 100;
        quotaInteressi = Math.round((importoRata - quotaCapitale) * 100) / 100;
      }

      debitoResiduo = Math.round((debitoResiduo - quotaCapitale) * 100) / 100;
      if (debitoResiduo < 0) debitoResiduo = 0;

      piano.push({
        numeroRata: i,
        quotaCapitale,
        quotaInteressi,
        importoRata,
        debitoResiduo,
      });
    }
  }

  return piano;
}

/**
 * Calculates total interest from a financing plan.
 */
export function calcolaTotaleInteressi(
  importoFinanziato: number,
  numeroRate: number,
  importoRata: number,
  tan?: number | null
): number {
  const piano = calcolaPianoFinanziamento(importoFinanziato, numeroRate, importoRata, tan);
  return piano.reduce((sum, r) => sum + r.quotaInteressi, 0);
}

// ---------------------------------------------------------------------------
// Sale (cessione) calculations
// ---------------------------------------------------------------------------

export type CalcoloCessione = {
  valoreResiduoContabile: number;
  plusvalenza: number;
  plusvalenzaImponibile: number;
  minusvalenza: number;
  minusvalenzaDeducibile: number;
};

/**
 * Calculates capital gain/loss on vehicle sale.
 *
 * The taxable portion of the gain (or deductible portion of the loss)
 * is proportional to the ratio of tax-deducted depreciation vs total depreciation.
 *
 * @param prezzoVendita - Sale price
 * @param costoStorico - Original asset cost (valoreIniziale of Cespite)
 * @param fondoAmmortamento - Total accumulated depreciation (from QuoteAmmortamento)
 * @param percentualeDeducibilita - Vehicle usage deductibility % (20% promiscuo, etc.)
 */
export function calcolaCessione(
  prezzoVendita: number,
  costoStorico: number,
  fondoAmmortamento: number,
  percentualeDeducibilita: number
): CalcoloCessione {
  const valoreResiduoContabile = Math.round((costoStorico - fondoAmmortamento) * 100) / 100;
  const ammortamentoDedotto = Math.round((fondoAmmortamento * percentualeDeducibilita / 100) * 100) / 100;
  const rapportoDeduzione = fondoAmmortamento > 0
    ? ammortamentoDedotto / fondoAmmortamento
    : percentualeDeducibilita / 100;

  let plusvalenza = 0;
  let plusvalenzaImponibile = 0;
  let minusvalenza = 0;
  let minusvalenzaDeducibile = 0;

  if (prezzoVendita > valoreResiduoContabile) {
    plusvalenza = Math.round((prezzoVendita - valoreResiduoContabile) * 100) / 100;
    plusvalenzaImponibile = Math.round(plusvalenza * rapportoDeduzione * 100) / 100;
  } else if (prezzoVendita < valoreResiduoContabile) {
    minusvalenza = Math.round((valoreResiduoContabile - prezzoVendita) * 100) / 100;
    minusvalenzaDeducibile = Math.round(minusvalenza * rapportoDeduzione * 100) / 100;
  }

  return {
    valoreResiduoContabile,
    plusvalenza,
    plusvalenzaImponibile,
    minusvalenza,
    minusvalenzaDeducibile,
  };
}

// ---------------------------------------------------------------------------
// Labels for display
// ---------------------------------------------------------------------------

export const TIPO_VEICOLO_LABELS: Record<TipoVeicolo, string> = {
  AUTOVETTURA: "Autovettura",
  MOTOCICLO: "Motociclo",
  CICLOMOTORE: "Ciclomotore",
  AUTOCARRO: "Autocarro",
};

export const USO_VEICOLO_LABELS: Record<UsoVeicolo, string> = {
  PROMISCUO: "Uso promiscuo",
  STRUMENTALE_ESCLUSIVO: "Strumentale esclusivo",
  USO_DIPENDENTE: "Uso a dipendente",
  AGENTE_COMMERCIO: "Agente di commercio",
};

export const MODALITA_ACQUISTO_LABELS: Record<string, string> = {
  CONTANTI: "Contanti",
  FINANZIAMENTO: "Finanziamento",
};
