import { prisma } from "@/lib/prisma";
import type { NotificaStato } from "@prisma/client";

export async function getUnreadCount(utenteId: number): Promise<number> {
  return prisma.notifica.count({
    where: { utenteDestinatarioId: utenteId, stato: "NON_LETTA" },
  });
}

export async function getNotifiche(utenteId: number, stato?: NotificaStato, limit = 20) {
  return prisma.notifica.findMany({
    where: { utenteDestinatarioId: utenteId, ...(stato ? { stato } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
