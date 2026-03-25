import type { ScadenzaFiscaleTipo } from "@prisma/client";

export type ScadenzaTemplate = {
  tipo: ScadenzaFiscaleTipo;
  nome: string;
  frequenza: "MENSILE" | "TRIMESTRALE" | "ANNUALE";
  giornoScadenza: number;
  meseScadenza?: number;
  condizione: (ctx: SocietaContext) => boolean;
  checklist: ChecklistTemplate[];
};

export type ChecklistTemplate = {
  descrizione: string;
  verificaAutomatica: boolean;
  queryVerifica?: string;
};

export type SocietaContext = {
  tipoAttivita: string;
  regimeFiscale: string;
  periodicityIva: "MENSILE" | "TRIMESTRALE";
  hasRitenute: boolean;
  hasCespiti: boolean;
  hasFattureElettroniche: boolean;
};

export type GeneraCalendarioResult = {
  scadenzeGenerate: number;
  scadenzeEsistenti: number;
};
