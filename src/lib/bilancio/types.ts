/**
 * Tipi per il Bilancio Civilistico (art. 2424/2425 c.c.)
 */

// ─── Struttura generica di una voce di bilancio ───

export type VoceBilancio = {
  codice: string;       // es. "1", "5-bis", "a"
  descrizione: string;
  importo: number;
  conti?: ContoAggregato[]; // conti che contribuiscono a questa voce
};

export type ContoAggregato = {
  contoId: number;
  codice: string;
  descrizione: string;
  saldo: number;
};

// ─── Stato Patrimoniale (art. 2424) ───

export type SottoclasseSP = {
  codice: string;       // es. "I", "II", "III", "IV"
  descrizione: string;
  importo: number;
  voci: VoceBilancio[];
};

export type ClasseSP = {
  codice: string;       // es. "A", "B", "C", "D", "E"
  descrizione: string;
  importo: number;
  sottoclassi: SottoclasseSP[];
  /** Voci direttamente sotto la classe (senza sottoclasse, es. SP Attivo D) */
  vociDirette: VoceBilancio[];
};

export type SezioneSP = {
  nome: "ATTIVO" | "PASSIVO";
  classi: ClasseSP[];
  totale: number;
};

export type StatoPatrimoniale = {
  attivo: SezioneSP;
  passivo: SezioneSP;
};

// ─── Conto Economico (art. 2425) ───

export type SottovoceCE = {
  codice: string;       // es. "a", "b", "c"
  descrizione: string;
  importo: number;
  conti?: ContoAggregato[];
};

export type VoceCE = {
  codice: string;       // es. "1", "6", "7", "10"
  descrizione: string;
  importo: number;
  sottovoci: SottovoceCE[];
  conti?: ContoAggregato[];
};

export type SezioneCE = {
  codice: string;       // es. "A", "B", "C", "D"
  descrizione: string;
  importo: number;
  voci: VoceCE[];
};

export type ContoEconomico = {
  sezioni: SezioneCE[];
  differenzaAB: number;        // A - B
  totaleC: number;             // proventi/oneri finanziari
  totaleD: number;             // rettifiche di valore
  risultatoPrimaImposte: number;
  imposte: number;             // voce 20
  utilePerditaEsercizio: number; // voce 21
};

// ─── Bilancio completo ───

export type BilancioCompleto = {
  anno: number;
  tipo: "ORDINARIO" | "ABBREVIATO";
  statoPatrimoniale: StatoPatrimoniale;
  contoEconomico: ContoEconomico;
  totaleAttivo: number;
  totalePassivo: number;
  utileEsercizio: number;
};

// ─── Input per i builder ───

export type SaldoConto = {
  contoId: number;
  codice: string;
  descrizione: string;
  tipo: string;          // TipoConto enum value
  naturaSaldo: string;   // NaturaSaldo enum value
  voceSp: string | null;
  voceCe: string | null;
  totaleDare: number;
  totaleAvere: number;
  saldo: number;         // dare - avere
};

// ─── Voce parsed ───

export type VoceParsed = {
  classe: string;        // es. "A", "B", "C", "D", "E"
  sottoclasse?: string;  // es. "I", "II", "III", "IV"
  voce?: string;         // es. "1", "2", "5-bis", "5-ter", "5-quater"
  sottovoce?: string;    // es. "a", "b", "c", "d"
};
