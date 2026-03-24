/**
 * Certificazione Unica (CU) types for Italian withholding tax certificates.
 */

export type CausaleCU = "A" | "C" | "M" | "L";

/**
 * Maps TipoRitenuta (from Prisma) to CU causale.
 */
export const TIPO_RITENUTA_TO_CAUSALE: Record<string, CausaleCU> = {
  LAVORO_AUTONOMO: "A",
  PROVVIGIONI: "C",
  OCCASIONALE: "M",
  DIRITTI_AUTORE: "L",
};

export const CAUSALE_DESCRIZIONI: Record<CausaleCU, string> = {
  A: "Prestazioni di lavoro autonomo rientranti nell'esercizio di arte o professione abituale",
  C: "Utili derivanti da contratti di associazione in partecipazione e da contratti di cointeressenza",
  M: "Prestazioni di lavoro autonomo non esercitate abitualmente / obblighi di fare, non fare o permettere",
  L: "Utilizzazione economica di opere dell'ingegno, brevetti industriali, ecc.",
};

/**
 * Data for a single CU record (one percipiente, one year).
 */
export type DatiCU = {
  anno: number;
  anagraficaId: number;
  // Percipiente data
  denominazione: string;
  codiceFiscale: string | null;
  partitaIva: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  // CU data
  causaleCu: CausaleCU;
  ammontareLordo: number;
  imponibile: number;
  ritenutaAcconto: number;
  rivalsaInps: number;
  cassaPrevidenza: number;
  // Detail: individual ritenute that compose this CU
  dettaglioRitenute: DettaglioRitenutaCU[];
};

export type DettaglioRitenutaCU = {
  ritenutaId: number;
  meseCompetenza: number;
  annoCompetenza: number;
  importoLordo: number;
  baseImponibile: number;
  importoRitenuta: number;
  codiceTributo: string;
  dataVersamento: Date | null;
  statoVersamento: string;
};

/**
 * Input ritenuta record (from DB query).
 */
export type RitenutaInput = {
  id: number;
  anagraficaId: number;
  tipoRitenuta: string;
  importoLordo: number;
  baseImponibile: number;
  importoRitenuta: number;
  rivalsaInps: number | null;
  cassaPrevidenza: number | null;
  meseCompetenza: number;
  annoCompetenza: number;
  codiceTributo: string;
  dataVersamento: Date | null;
  statoVersamento: string;
  anagrafica: {
    id: number;
    denominazione: string;
    codiceFiscale: string | null;
    partitaIva: string | null;
    indirizzo: string | null;
    cap: string | null;
    citta: string | null;
    provincia: string | null;
  };
};

/**
 * Summary CU data for export.
 */
export type RiepilogoCU = {
  anno: number;
  totalePercipienti: number;
  totaleLordo: number;
  totaleRitenute: number;
  percipienti: DatiCU[];
};
