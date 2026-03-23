import { prisma } from "./prisma";

export async function requireCompanyAccess(utenteId: number, societaId: number) {
  const access = await prisma.utenteAzienda.findUnique({
    where: { utenteId_societaId: { utenteId, societaId } },
  });
  if (!access || !access.attivo) return null;
  return access;
}

export async function getUtenteAziendeCount(utenteId: number): Promise<number> {
  return prisma.utenteAzienda.count({
    where: { utenteId, attivo: true },
  });
}

export async function getDefaultAzienda(utenteId: number) {
  return prisma.utenteAzienda.findFirst({
    where: { utenteId, attivo: true },
    orderBy: { ultimoAccesso: { sort: 'desc', nulls: 'last' } },
    include: { societa: { select: { id: true, ragioneSociale: true } } },
  });
}

export function mapRuoloForSession(ruoloAzienda: string): string {
  if (ruoloAzienda === 'COMMERCIALISTA') return 'ADMIN';
  return ruoloAzienda;
}
