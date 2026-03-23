export type SessionUser = {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;                 // Populated from UtenteAzienda.ruolo via mapRuoloForSession
  ruoloAzienda: string | null;   // Original role (ADMIN|STANDARD|COMMERCIALISTA)
  isSuperAdmin: boolean;
  socioId: number | null;        // null for commercialista
  societaId: number | null;
  quotaPercentuale: number;
  emailVerificata: boolean;
  modalitaAvanzata: boolean;
  modalitaCommercialista: boolean;
  numeroAziende: number;
};
