import type { AnomaliaTipo, AnomaliaSorgente, NotificaPriorita } from "@prisma/client";

export type CheckResult = {
  found: boolean;
  anomalie: AnomaliaData[];
};

export type AnomaliaData = {
  tipo: AnomaliaTipo;
  sorgente: AnomaliaSorgente;
  priorita: NotificaPriorita;
  titolo: string;
  descrizione: string;
  entityType?: string;
  entityId?: number;
  metadati?: Record<string, unknown>;
};

export type CheckDefinition = {
  id: string;
  nome: string;
  sorgente: AnomaliaSorgente;
  run: (societaId: number, anno: number) => Promise<CheckResult>;
};
