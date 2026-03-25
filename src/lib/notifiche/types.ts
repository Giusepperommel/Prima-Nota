import type { NotificaTipo, NotificaPriorita, NotificaCanale } from "@prisma/client";

export type CreateNotificaInput = {
  societaId: number;
  utenteDestinatarioId: number;
  tipo: NotificaTipo;
  priorita: NotificaPriorita;
  titolo: string;
  messaggio: string;
  entityType?: string;
  entityId?: number;
  canale?: NotificaCanale;
  scheduledAt?: Date;
};

export const PRIORITY_CHANNEL_MAP: Record<NotificaPriorita, NotificaCanale> = {
  CRITICA: "EMAIL",
  ALTA: "IN_APP",
  MEDIA: "IN_APP",
  BASSA: "IN_APP",
};
