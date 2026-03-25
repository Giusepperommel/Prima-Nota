import { prisma } from "@/lib/prisma";

/**
 * Find all F24 deadlines (IVA + RITENUTE) that are ready to be sent/paid
 * across multiple societa for a given period.
 */
export async function generaTuttiF24Pronti(
  societaIds: number[],
  anno: number,
  periodo: number
) {
  return prisma.scadenzaFiscale.findMany({
    where: {
      societaId: { in: societaIds },
      tipo: { in: ["F24_IVA", "F24_RITENUTE"] },
      anno,
      periodo,
      stato: "PRONTA",
    },
    include: { societa: { select: { ragioneSociale: true } } },
  });
}

/**
 * Find all F24 IVA deadlines that are in preparation (liquidazione needed)
 * across multiple societa for a given period.
 */
export async function calcolaTutteLiquidazioni(
  societaIds: number[],
  anno: number,
  periodo: number
) {
  return prisma.scadenzaFiscale.findMany({
    where: {
      societaId: { in: societaIds },
      tipo: "F24_IVA",
      anno,
      periodo,
      stato: "IN_PREPARAZIONE",
    },
    include: {
      societa: { select: { ragioneSociale: true } },
      checklist: true,
    },
  });
}

/**
 * Get all fiscal deadlines for a given month across multiple societa.
 * Used by the Copilota Adempimenti dashboard for the multi-company view.
 */
export async function getScadenzeMultiSocieta(
  societaIds: number[],
  anno: number,
  mese: number
) {
  const startOfMonth = new Date(anno, mese - 1, 1);
  const endOfMonth = new Date(anno, mese, 0);

  return prisma.scadenzaFiscale.findMany({
    where: {
      societaId: { in: societaIds },
      scadenza: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      societa: { select: { ragioneSociale: true } },
      checklist: true,
    },
    orderBy: { scadenza: "asc" },
  });
}
