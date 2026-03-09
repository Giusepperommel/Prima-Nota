/**
 * Database-level helpers for querying depreciation data.
 * Used by KPI, dashboard, and report API routes.
 */

import { prisma } from "@/lib/prisma";

/**
 * Total depreciation cost for a societa in a given year.
 */
export async function getAmmortamentoTotaleSocieta(
  societaId: number,
  anno: number,
): Promise<number> {
  const result = await prisma.quotaAmmortamento.aggregate({
    _sum: { importoQuota: true },
    where: {
      anno,
      cespite: {
        societaId,
        operazione: { eliminato: false },
      },
    },
  });
  return Number(result._sum.importoQuota ?? 0);
}

/**
 * Depreciation cost for a specific socio in a given year.
 * Applies each cespite's ripartizione percentage to the yearly quota.
 */
export async function getAmmortamentoSocio(
  societaId: number,
  socioId: number,
  anno: number,
): Promise<number> {
  const cespiti = await prisma.cespite.findMany({
    where: {
      societaId,
      operazione: { eliminato: false },
      quoteAmmortamento: { some: { anno } },
    },
    include: {
      quoteAmmortamento: { where: { anno } },
      operazione: {
        include: {
          ripartizioni: { where: { socioId } },
        },
      },
    },
  });

  let totale = 0;
  for (const cespite of cespiti) {
    const quota = cespite.quoteAmmortamento[0];
    const ripartizione = cespite.operazione.ripartizioni[0];
    if (quota && ripartizione) {
      const percentuale = Number(ripartizione.percentuale);
      const importoQuota = Number(quota.importoQuota);
      totale +=
        Math.round(((importoQuota * percentuale) / 100) * 100) / 100;
    }
  }

  return Math.round(totale * 100) / 100;
}

/**
 * Depreciation breakdown per socio for a given year.
 */
export async function getAmmortamentoPerSocio(
  societaId: number,
  anno: number,
): Promise<{ socioId: number; ammortamento: number }[]> {
  const cespiti = await prisma.cespite.findMany({
    where: {
      societaId,
      operazione: { eliminato: false },
      quoteAmmortamento: { some: { anno } },
    },
    include: {
      quoteAmmortamento: { where: { anno } },
      operazione: {
        include: {
          ripartizioni: true,
        },
      },
    },
  });

  const socioMap = new Map<number, number>();

  for (const cespite of cespiti) {
    const quota = cespite.quoteAmmortamento[0];
    if (!quota) continue;
    const importoQuota = Number(quota.importoQuota);

    for (const rip of cespite.operazione.ripartizioni) {
      const percentuale = Number(rip.percentuale);
      const share =
        Math.round(((importoQuota * percentuale) / 100) * 100) / 100;
      const current = socioMap.get(rip.socioId) ?? 0;
      socioMap.set(
        rip.socioId,
        Math.round((current + share) * 100) / 100,
      );
    }
  }

  return Array.from(socioMap.entries()).map(([socioId, ammortamento]) => ({
    socioId,
    ammortamento,
  }));
}
