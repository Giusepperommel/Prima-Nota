/**
 * Simplified Redditi SC and IRAP calculation summary.
 * Uses existing tax-utils.ts calculations to produce structured data
 * for tax declaration preparation.
 *
 * Pure function — no DB access. All data passed as parameters.
 */

import { calcolaIRES, calcolaIRAP } from "@/lib/tax-utils";
import { IRES_RATE } from "@/lib/tax-constants";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Types ───

export type DatiBilancio = {
  anno: number;
  ricavi: number;        // A) Valore della produzione
  costi: number;         // B) Costi della produzione
  proventiFinanziari: number; // C) Proventi finanziari netti
  oneriFinanziari: number;    // C) Oneri finanziari
  proventiStraordinari: number; // E) Proventi straordinari
  oneriStraordinari: number;    // E) Oneri straordinari
  ammortamenti: number;  // Subset of costi already included
};

export type DatiSocieta = {
  tipoAttivita: string;
  regimeFiscale: string;
  aliquotaIrap: number;
  capitaleSociale: number | null;
};

export type AccontiVersati = {
  iresAcconto1: number;
  iresAcconto2: number;
  irapAcconto1: number;
  irapAcconto2: number;
};

export type RiepilogoRedditi = {
  anno: number;
  // Conto economico sintetico
  valoreProduzioneNetta: number;
  risultatoFinanziario: number;
  risultatoStraordinario: number;
  risultatoPrimaImposte: number;

  // Variazioni fiscali (simplified)
  variazioniAumento: VariazioneFiscale[];
  variazioniDiminuzione: VariazioneFiscale[];
  totaleVariazioniAumento: number;
  totaleVariazioniDiminuzione: number;

  // Reddito imponibile
  redditoImponibileIres: number;
  aliquotaIres: number;
  iresLorda: number;

  // IRAP
  baseImponibileIrap: number;
  aliquotaIrap: number;
  irapLorda: number;

  // Deduzioni
  deduzioneIrapDaIres: number; // 10% dell'IRAP pagata deducibile da IRES

  // Imposte nette
  iresNetta: number;
  irapNetta: number;
  totaleImposte: number;

  // Acconti e saldi
  accontiIresVersati: number;
  accontiIrapVersati: number;
  saldoIres: number; // positivo = a debito, negativo = a credito
  saldoIrap: number;

  // Acconti prossimo anno (metodo storico: 100% dell'imposta)
  accontoIresProssimoAnno: number;
  accontoIres1: number; // 40%
  accontoIres2: number; // 60%
  accontoIrapProssimoAnno: number;
  accontoIrap1: number; // 40%
  accontoIrap2: number; // 60%
};

export type VariazioneFiscale = {
  descrizione: string;
  importo: number;
  riferimentoNormativo: string;
};

// ─── Calculation ───

/**
 * Calculates a simplified Redditi SC + IRAP summary.
 */
export function calcolaRedditi(
  bilancio: DatiBilancio,
  societa: DatiSocieta,
  accontiVersati: AccontiVersati,
): RiepilogoRedditi {
  const anno = bilancio.anno;

  // Conto economico sintetico
  const valoreProduzioneNetta = round2(bilancio.ricavi - bilancio.costi);
  const risultatoFinanziario = round2(bilancio.proventiFinanziari - bilancio.oneriFinanziari);
  const risultatoStraordinario = round2(bilancio.proventiStraordinari - bilancio.oneriStraordinari);
  const risultatoPrimaImposte = round2(
    valoreProduzioneNetta + risultatoFinanziario + risultatoStraordinario,
  );

  // Variazioni fiscali (simplified — only common ones)
  const variazioniAumento: VariazioneFiscale[] = [];
  const variazioniDiminuzione: VariazioneFiscale[] = [];

  // IRAP deduction from IRES (10% of IRAP paid) — this is a diminuzione
  // We calculate IRAP first to know the deduction
  const baseImponibileIrap = Math.max(0, valoreProduzioneNetta);
  const aliquotaIrap = societa.aliquotaIrap;
  const irapLorda = calcolaIRAP(baseImponibileIrap, aliquotaIrap);

  // Deduction: 10% of IRAP is deductible from IRES base
  const deduzioneIrapDaIres = round2(irapLorda * 0.10);
  if (deduzioneIrapDaIres > 0) {
    variazioniDiminuzione.push({
      descrizione: "Deduzione IRAP 10%",
      importo: deduzioneIrapDaIres,
      riferimentoNormativo: "Art. 6 DL 185/2008",
    });
  }

  const totaleVariazioniAumento = round2(
    variazioniAumento.reduce((sum, v) => sum + v.importo, 0),
  );
  const totaleVariazioniDiminuzione = round2(
    variazioniDiminuzione.reduce((sum, v) => sum + v.importo, 0),
  );

  // IRES
  const redditoImponibileIres = round2(
    Math.max(0, risultatoPrimaImposte + totaleVariazioniAumento - totaleVariazioniDiminuzione),
  );
  const aliquotaIres = IRES_RATE;
  const iresLorda = calcolaIRES(redditoImponibileIres);
  const iresNetta = iresLorda; // No credits applied in this simplified version
  const irapNetta = irapLorda;
  const totaleImposte = round2(iresNetta + irapNetta);

  // Saldi (considering acconti already paid)
  const accontiIresVersati = round2(accontiVersati.iresAcconto1 + accontiVersati.iresAcconto2);
  const accontiIrapVersati = round2(accontiVersati.irapAcconto1 + accontiVersati.irapAcconto2);

  const saldoIres = round2(iresNetta - accontiIresVersati);
  const saldoIrap = round2(irapNetta - accontiIrapVersati);

  // Acconti prossimo anno (metodo storico: 100% dell'imposta corrente)
  const accontoIresProssimoAnno = iresNetta;
  const accontoIres1 = round2(accontoIresProssimoAnno * 0.40);
  const accontoIres2 = round2(accontoIresProssimoAnno * 0.60);

  const accontoIrapProssimoAnno = irapNetta;
  const accontoIrap1 = round2(accontoIrapProssimoAnno * 0.40);
  const accontoIrap2 = round2(accontoIrapProssimoAnno * 0.60);

  return {
    anno,
    valoreProduzioneNetta,
    risultatoFinanziario,
    risultatoStraordinario,
    risultatoPrimaImposte,
    variazioniAumento,
    variazioniDiminuzione,
    totaleVariazioniAumento,
    totaleVariazioniDiminuzione,
    redditoImponibileIres,
    aliquotaIres,
    iresLorda,
    baseImponibileIrap,
    aliquotaIrap,
    irapLorda,
    deduzioneIrapDaIres,
    iresNetta,
    irapNetta,
    totaleImposte,
    accontiIresVersati,
    accontiIrapVersati,
    saldoIres,
    saldoIrap,
    accontoIresProssimoAnno,
    accontoIres1,
    accontoIres2,
    accontoIrapProssimoAnno,
    accontoIrap1,
    accontoIrap2,
  };
}

/**
 * Calculates Modello 770 summary from CU data.
 * The 770 is essentially an aggregation of all CU records.
 */
export type Riepilogo770 = {
  anno: number;
  // Quadro ST — ritenute operate e versate
  totaleRitenuteOperate: number;
  totaleRitenuteVersate: number;
  ritenuteNonVersate: number;
  // Per codice tributo
  dettaglioPerCodice: {
    codiceTributo: string;
    totaleOperato: number;
    totaleVersato: number;
  }[];
  numeroPercipienti: number;
};

export function calcolaRiepilogo770(
  ritenute: Array<{
    codiceTributo: string;
    importoRitenuta: number;
    importoVersato: number | null;
    statoVersamento: string;
  }>,
): Riepilogo770 {
  let totaleRitenuteOperate = 0;
  let totaleRitenuteVersate = 0;

  const perCodice = new Map<string, { operato: number; versato: number }>();

  for (const r of ritenute) {
    totaleRitenuteOperate += r.importoRitenuta;
    const versato = r.statoVersamento === "VERSATO" ? (r.importoVersato ?? r.importoRitenuta) : 0;
    totaleRitenuteVersate += versato;

    const existing = perCodice.get(r.codiceTributo) ?? { operato: 0, versato: 0 };
    existing.operato += r.importoRitenuta;
    existing.versato += versato;
    perCodice.set(r.codiceTributo, existing);
  }

  return {
    anno: 0, // Will be set by caller
    totaleRitenuteOperate: round2(totaleRitenuteOperate),
    totaleRitenuteVersate: round2(totaleRitenuteVersate),
    ritenuteNonVersate: round2(totaleRitenuteOperate - totaleRitenuteVersate),
    dettaglioPerCodice: Array.from(perCodice.entries()).map(([codice, data]) => ({
      codiceTributo: codice,
      totaleOperato: round2(data.operato),
      totaleVersato: round2(data.versato),
    })),
    numeroPercipienti: 0, // Will be set by caller
  };
}
