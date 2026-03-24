/**
 * F24 types, codici tributo, and constants for Italian tax payments.
 */

// ─── Sezioni F24 ───

export type SezioneF24 = "ERARIO" | "INPS" | "REGIONI_ENTI_LOCALI";

// ─── Riga F24 ───

export type RigaF24 = {
  sezione: SezioneF24;
  codiceTributo: string;
  rateazione?: string;
  annoRiferimento: number;
  periodoRiferimento?: string; // "01"-"12" for months, "0101"-"1231" for ranges
  importoDebito: number;
  importoCredito: number;
  descrizione: string;
};

// ─── F24 Completo ───

export type F24Data = {
  anno: number;
  mese: number;
  dataScadenza: Date;
  righe: RigaF24[];
  totaleDebito: number;
  totaleCredito: number;
  totaleVersamento: number;
};

// ─── Input per generazione F24 ───

export type RitenutaDaVersare = {
  codiceTributo: string;
  importoRitenuta: number;
  meseCompetenza: number;
  annoCompetenza: number;
};

export type IvaDaVersare = {
  importo: number;
  periodo: number; // mese 1-12 or trimestre 1-4
  anno: number;
  tipo: "MENSILE" | "TRIMESTRALE" | "ANNUALE" | "ACCONTO";
};

export type ImpostaDaVersare = {
  tipo: "IRES_SALDO" | "IRES_ACCONTO_1" | "IRES_ACCONTO_2" | "IRAP_SALDO" | "IRAP_ACCONTO_1" | "IRAP_ACCONTO_2";
  importo: number;
  anno: number;
};

export type BolloDaVersare = {
  tipo: "LIBRO_GIORNALE" | "TASSA_CCGG" | "BOLLO_FE_Q1" | "BOLLO_FE_Q2" | "BOLLO_FE_Q3" | "BOLLO_FE_Q4";
  importo: number;
  anno: number;
};

export type CreditoDisponibile = {
  tipo: "IVA" | "IRES" | "IRAP";
  importo: number;
  annoOrigine: number;
  richiedeVisto: boolean; // true if IVA > 5000
};

export type GeneraF24Input = {
  anno: number;
  mese: number;
  ritenute: RitenutaDaVersare[];
  iva?: IvaDaVersare;
  imposte: ImpostaDaVersare[];
  bolli: BolloDaVersare[];
  creditiCompensazione: CreditoDisponibile[];
};

// ─── Codici Tributo ───

export const CODICI_TRIBUTO = {
  // Ritenute
  RITENUTA_LAVORO_AUTONOMO: "1040",
  RITENUTA_PROVVIGIONI: "1038",
  RITENUTA_DIRITTI_AUTORE: "1041",

  // IRES
  IRES_SALDO: "2003",
  IRES_ACCONTO_1: "2001",
  IRES_ACCONTO_2: "2002",

  // IRAP
  IRAP_SALDO: "3800",
  IRAP_ACCONTO_1: "3800",
  IRAP_ACCONTO_2: "3801",

  // IVA mensile
  IVA_MENSILE: (mese: number) => `600${mese.toString().padStart(1, "0")}`,
  IVA_MENSILE_MAP: {
    1: "6001", 2: "6002", 3: "6003", 4: "6004", 5: "6005", 6: "6006",
    7: "6007", 8: "6008", 9: "6009", 10: "6010", 11: "6011", 12: "6012",
  } as Record<number, string>,
  IVA_TRIMESTRALE_MAP: {
    1: "6031", 2: "6032", 3: "6033",
  } as Record<number, string>,
  IVA_ANNUALE: "6099",
  IVA_ACCONTO: "6013",

  // Bollo
  BOLLO_LIBRO_GIORNALE: "2501",
  TASSA_CCGG: "7085",
  BOLLO_FE: { Q1: "2524", Q2: "2525", Q3: "2526", Q4: "2527" },
} as const;

// ─── Mappatura tipo imposta -> codice tributo ───

export const IMPOSTA_TO_CODICE: Record<ImpostaDaVersare["tipo"], string> = {
  IRES_SALDO: CODICI_TRIBUTO.IRES_SALDO,
  IRES_ACCONTO_1: CODICI_TRIBUTO.IRES_ACCONTO_1,
  IRES_ACCONTO_2: CODICI_TRIBUTO.IRES_ACCONTO_2,
  IRAP_SALDO: CODICI_TRIBUTO.IRAP_SALDO,
  IRAP_ACCONTO_1: CODICI_TRIBUTO.IRAP_ACCONTO_1,
  IRAP_ACCONTO_2: CODICI_TRIBUTO.IRAP_ACCONTO_2,
};

export const BOLLO_TO_CODICE: Record<BolloDaVersare["tipo"], string> = {
  LIBRO_GIORNALE: CODICI_TRIBUTO.BOLLO_LIBRO_GIORNALE,
  TASSA_CCGG: CODICI_TRIBUTO.TASSA_CCGG,
  BOLLO_FE_Q1: CODICI_TRIBUTO.BOLLO_FE.Q1,
  BOLLO_FE_Q2: CODICI_TRIBUTO.BOLLO_FE.Q2,
  BOLLO_FE_Q3: CODICI_TRIBUTO.BOLLO_FE.Q3,
  BOLLO_FE_Q4: CODICI_TRIBUTO.BOLLO_FE.Q4,
};

// ─── Limiti compensazione ───

export const LIMITE_COMPENSAZIONE_ANNUO = 2_000_000;
export const SOGLIA_VISTO_IVA = 5_000;

// ─── Scadenze F24 ───

/**
 * Returns the F24 payment due date for ritenute/IVA of a given month.
 * Ritenute and IVA mensile: 16th of the following month.
 */
export function scadenzaF24Mensile(anno: number, mese: number): Date {
  if (mese === 12) {
    return new Date(anno + 1, 0, 16); // Jan 16 next year
  }
  return new Date(anno, mese, 16); // 16th of following month
}

/**
 * Scadenziario fiscale annuale — returns all major deadlines for a given year.
 */
export type ScadenzaFiscale = {
  data: Date;
  descrizione: string;
  tipo: "F24" | "DICHIARAZIONE" | "CU" | "BOLLO";
};

export function getScadenziarioAnnuale(anno: number): ScadenzaFiscale[] {
  const scadenze: ScadenzaFiscale[] = [];

  // Monthly: ritenute (16th of each month for previous month)
  for (let m = 1; m <= 12; m++) {
    const data = scadenzaF24Mensile(anno, m === 1 ? 12 : m - 1);
    if (m === 1) data.setFullYear(anno); // Jan is for Dec of same declared year
    scadenze.push({
      data: new Date(anno, m - 1, 16),
      descrizione: `Versamento ritenute ${String(m === 1 ? 12 : m - 1).padStart(2, "0")}/${m === 1 ? anno - 1 : anno}`,
      tipo: "F24",
    });
  }

  // CU
  scadenze.push({ data: new Date(anno, 2, 16), descrizione: "CU — invio e consegna percipienti", tipo: "CU" });

  // Tassa CC.GG.
  scadenze.push({ data: new Date(anno, 2, 16), descrizione: "Tassa CC.GG. libri sociali", tipo: "BOLLO" });

  // IVA annuale saldo
  scadenze.push({ data: new Date(anno, 2, 16), descrizione: `Saldo IVA annuale ${anno - 1}`, tipo: "F24" });

  // Bollo libro giornale
  scadenze.push({ data: new Date(anno, 3, 30), descrizione: "Bollo libro giornale", tipo: "BOLLO" });

  // Bollo FE
  scadenze.push({ data: new Date(anno, 4, 31), descrizione: "Bollo fatture elettroniche I trim", tipo: "BOLLO" });
  scadenze.push({ data: new Date(anno, 8, 30), descrizione: "Bollo fatture elettroniche II trim", tipo: "BOLLO" });
  scadenze.push({ data: new Date(anno, 10, 30), descrizione: "Bollo fatture elettroniche III trim", tipo: "BOLLO" });
  scadenze.push({ data: new Date(anno + 1, 1, 28), descrizione: "Bollo fatture elettroniche IV trim", tipo: "BOLLO" });

  // IRES/IRAP saldo + I acconto
  scadenze.push({ data: new Date(anno, 5, 30), descrizione: `Saldo IRES ${anno - 1} + I acconto ${anno}`, tipo: "F24" });
  scadenze.push({ data: new Date(anno, 5, 30), descrizione: `Saldo IRAP ${anno - 1} + I acconto ${anno}`, tipo: "F24" });

  // II acconto
  scadenze.push({ data: new Date(anno, 10, 30), descrizione: `II acconto IRES ${anno}`, tipo: "F24" });
  scadenze.push({ data: new Date(anno, 10, 30), descrizione: `II acconto IRAP ${anno}`, tipo: "F24" });

  // 770
  scadenze.push({ data: new Date(anno, 9, 31), descrizione: `Modello 770 anno ${anno - 1}`, tipo: "DICHIARAZIONE" });

  // Redditi SC + IRAP dichiarazione
  scadenze.push({ data: new Date(anno, 10, 30), descrizione: `Modello Redditi SC ${anno - 1}`, tipo: "DICHIARAZIONE" });
  scadenze.push({ data: new Date(anno, 10, 30), descrizione: `Dichiarazione IRAP ${anno - 1}`, tipo: "DICHIARAZIONE" });

  // Acconto IVA
  scadenze.push({ data: new Date(anno, 11, 27), descrizione: "Acconto IVA", tipo: "F24" });

  return scadenze.sort((a, b) => a.data.getTime() - b.data.getTime());
}
