import { prisma } from "@/lib/prisma";
import type { CreateNotificaInput } from "./types";
import { PRIORITY_CHANNEL_MAP } from "./types";
import { sendNotificaEmail } from "./channels/email";

export class NotificationEngine {
  async send(input: CreateNotificaInput): Promise<{ id: number }> {
    const canale = input.canale ?? PRIORITY_CHANNEL_MAP[input.priorita];

    // Create the notification record
    const notifica = await prisma.notifica.create({
      data: {
        societaId: input.societaId,
        utenteDestinatarioId: input.utenteDestinatarioId,
        tipo: input.tipo,
        priorita: input.priorita,
        titolo: input.titolo,
        messaggio: input.messaggio,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        canale,
        scheduledAt: input.scheduledAt ?? null,
      },
    });

    // For EMAIL channel (CRITICA priority), send email immediately if user hasn't disabled it
    if (canale === "EMAIL") {
      const emailDisabled = await this.checkEmailPreference(
        input.utenteDestinatarioId,
        input.tipo
      );

      if (!emailDisabled) {
        const utente = await prisma.utente.findUnique({
          where: { id: input.utenteDestinatarioId },
        });

        if (utente?.email) {
          await sendNotificaEmail(utente.email, input.titolo, input.messaggio);
        }
      }
    }

    return { id: notifica.id };
  }

  async markAsRead(notificaId: number, utenteId: number): Promise<void> {
    await prisma.notifica.updateMany({
      where: { id: notificaId, utenteDestinatarioId: utenteId },
      data: { stato: "LETTA" },
    });
  }

  async markAllAsRead(utenteId: number): Promise<void> {
    await prisma.notifica.updateMany({
      where: { utenteDestinatarioId: utenteId, stato: "NON_LETTA" },
      data: { stato: "LETTA" },
    });
  }

  private async checkEmailPreference(
    utenteId: number,
    tipoEvento: string
  ): Promise<boolean> {
    const preference = await prisma.preferenzaNotifica.findFirst({
      where: {
        utenteId,
        tipoEvento,
        canale: "EMAIL",
      },
    });

    // If preference exists and is disabled, email is disabled
    return preference?.abilitato === false;
  }
}
