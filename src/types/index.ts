import type { RuoloUtente } from "@prisma/client";

export type SessionUser = {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: RuoloUtente;
  socioId: number;
  societaId: number | null;
  quotaPercentuale: number;
  emailVerificata: boolean;
};
