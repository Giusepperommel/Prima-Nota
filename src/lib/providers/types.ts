import type { ProviderTipo, ProviderNome, ProviderStato } from "@prisma/client";

export type FatturaImportata = {
  identificativoSdi?: string;
  nomeFile?: string;
  tipoDocumento: string;
  cedente: {
    denominazione: string;
    partitaIva?: string;
    codiceFiscale?: string;
    nazione: string;
  };
  dataFattura: Date;
  numeroFattura: string;
  importoTotale: number;
  imponibile: number;
  iva: number;
  aliquotaIva: number;
  righe: FatturaRiga[];
  scadenzePagamento: ScadenzaPagamento[];
  xmlOriginale?: string;
};

export type FatturaRiga = {
  descrizione: string;
  quantita?: number;
  prezzoUnitario?: number;
  importo: number;
  aliquotaIva: number;
  natura?: string;
};

export type ScadenzaPagamento = {
  data: Date;
  importo: number;
  modalita?: string;
};

export type StatoInvio = {
  stato: "INVIATA" | "CONSEGNATA" | "SCARTATA" | "ERRORE";
  identificativoSdi?: string;
  errore?: string;
};

export type StatoFattura = {
  stato: "INVIATA" | "CONSEGNATA" | "ACCETTATA" | "RIFIUTATA" | "SCARTATA" | "DECORRENZA_TERMINI";
  dataAggiornamento: Date;
  errore?: string;
};

export interface FattureProvider {
  importaFatturePassive(files?: File[]): Promise<FatturaImportata[]>;
  inviaFatturaAttiva?(fatturaId: number): Promise<StatoInvio>;
  getStatoFattura?(identificativoSdi: string): Promise<StatoFattura>;
  sync?(): Promise<SyncResult>;
}

export type MovimentoBancarioImportato = {
  data: Date;
  dataValuta?: Date;
  importo: number;
  descrizione: string;
  causale?: string;
  riferimento?: string;
};

export type SaldoBancario = {
  iban: string;
  saldo: number;
  dataAggiornamento: Date;
};

export type ContoBancario = {
  iban: string;
  denominazione: string;
  banca: string;
};

export interface BancaProvider {
  getMovimenti(from: Date, to: Date): Promise<MovimentoBancarioImportato[]>;
  getSaldo?(iban: string): Promise<SaldoBancario>;
  getConti?(): Promise<ContoBancario[]>;
  sync?(): Promise<SyncResult>;
}

export type SyncResult = {
  success: boolean;
  importati: number;
  errori: number;
  dettagli?: string;
};

export type ProviderConfigData = {
  societaId: number;
  tipo: ProviderTipo;
  provider: ProviderNome;
  credenziali?: Record<string, unknown>;
  configExtra?: Record<string, unknown>;
};
