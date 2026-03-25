/**
 * Registro Beni Ammortizzabili (art. 16 DPR 600/73)
 * Generates the statutory fixed-asset register with both
 * civil and fiscal depreciation tracking.
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RigaRegistro = {
  cespiteId: number;
  descrizione: string;
  dataAcquisto: string; // ISO date
  annoAcquisto: number;
  costoStorico: number;
  aliquotaAmmortamento: number;
  stato: string;
  // Civilistico
  quotaCivilistico: number;
  fondoCivilistico: number;
  // Fiscale
  quotaFiscale: number;
  fondoFiscale: number;
  // Derived
  valoreResiduoCivilistico: number;
  valoreResiduoFiscale: number;
  // Veicolo info (optional)
  veicolo?: {
    marca: string;
    modello: string;
    targa: string;
    tipoVeicolo: string;
    usoVeicolo: string;
  } | null;
};

export type RegistroAmmortizzabili = {
  anno: number;
  societaId: number;
  righe: RigaRegistro[];
  totali: {
    costoStorico: number;
    quotaCivilistico: number;
    fondoCivilistico: number;
    quotaFiscale: number;
    fondoFiscale: number;
    valoreResiduoCivilistico: number;
    valoreResiduoFiscale: number;
  };
};

// ---------------------------------------------------------------------------
// Pure computation (testable without DB)
// ---------------------------------------------------------------------------

export type CespiteConQuote = {
  id: number;
  descrizione: string;
  dataAcquisto: Date;
  annoInizio: number;
  valoreIniziale: number;
  aliquotaAmmortamento: number;
  stato: string;
  quoteAmmortamento: {
    anno: number;
    importoQuota: number;
    fondoProgressivo: number;
    importoQuotaFiscale: number | null;
    fondoProgressivoFiscale: number | null;
  }[];
  veicolo?: {
    marca: string;
    modello: string;
    targa: string;
    tipoVeicolo: string;
    usoVeicolo: string;
  } | null;
};

export function calcolaRegistro(
  cespiti: CespiteConQuote[],
  anno: number,
  societaId: number,
): RegistroAmmortizzabili {
  const righe: RigaRegistro[] = [];

  for (const c of cespiti) {
    const costoStorico = Number(c.valoreIniziale);
    const quotaAnno = c.quoteAmmortamento.find((q) => q.anno === anno);

    // Find cumulative fund up to this year
    const quoteFinoAnno = c.quoteAmmortamento.filter((q) => q.anno <= anno);
    const ultimaQuota = quoteFinoAnno.length > 0
      ? quoteFinoAnno.reduce((prev, curr) => (curr.anno > prev.anno ? curr : prev))
      : null;

    const quotaCivilistico = quotaAnno ? Number(quotaAnno.importoQuota) : 0;
    const fondoCivilistico = ultimaQuota ? Number(ultimaQuota.fondoProgressivo) : 0;

    const quotaFiscale = quotaAnno
      ? Number(quotaAnno.importoQuotaFiscale ?? quotaAnno.importoQuota)
      : 0;
    const fondoFiscale = ultimaQuota
      ? Number(ultimaQuota.fondoProgressivoFiscale ?? ultimaQuota.fondoProgressivo)
      : 0;

    righe.push({
      cespiteId: c.id,
      descrizione: c.descrizione,
      dataAcquisto: c.dataAcquisto instanceof Date
        ? c.dataAcquisto.toISOString().slice(0, 10)
        : String(c.dataAcquisto),
      annoAcquisto: c.annoInizio,
      costoStorico,
      aliquotaAmmortamento: Number(c.aliquotaAmmortamento),
      stato: c.stato,
      quotaCivilistico,
      fondoCivilistico,
      quotaFiscale,
      fondoFiscale,
      valoreResiduoCivilistico: Math.round((costoStorico - fondoCivilistico) * 100) / 100,
      valoreResiduoFiscale: Math.round((costoStorico - fondoFiscale) * 100) / 100,
      veicolo: c.veicolo ?? null,
    });
  }

  const totali = righe.reduce(
    (acc, r) => ({
      costoStorico: acc.costoStorico + r.costoStorico,
      quotaCivilistico: acc.quotaCivilistico + r.quotaCivilistico,
      fondoCivilistico: acc.fondoCivilistico + r.fondoCivilistico,
      quotaFiscale: acc.quotaFiscale + r.quotaFiscale,
      fondoFiscale: acc.fondoFiscale + r.fondoFiscale,
      valoreResiduoCivilistico: acc.valoreResiduoCivilistico + r.valoreResiduoCivilistico,
      valoreResiduoFiscale: acc.valoreResiduoFiscale + r.valoreResiduoFiscale,
    }),
    {
      costoStorico: 0,
      quotaCivilistico: 0,
      fondoCivilistico: 0,
      quotaFiscale: 0,
      fondoFiscale: 0,
      valoreResiduoCivilistico: 0,
      valoreResiduoFiscale: 0,
    },
  );

  // Round totals
  for (const key of Object.keys(totali) as (keyof typeof totali)[]) {
    totali[key] = Math.round(totali[key] * 100) / 100;
  }

  return { anno, societaId, righe, totali };
}

// ---------------------------------------------------------------------------
// DB query
// ---------------------------------------------------------------------------

export async function getRegistroAmmortizzabili(
  societaId: number,
  anno: number,
): Promise<RegistroAmmortizzabili> {
  const cespiti = await prisma.cespite.findMany({
    where: {
      societaId,
      operazione: { eliminato: false },
      annoInizio: { lte: anno },
    },
    include: {
      quoteAmmortamento: {
        where: { anno: { lte: anno } },
        orderBy: { anno: "asc" },
      },
      veicolo: {
        select: {
          marca: true,
          modello: true,
          targa: true,
          tipoVeicolo: true,
          usoVeicolo: true,
        },
      },
    },
    orderBy: { dataAcquisto: "asc" },
  });

  const mapped: CespiteConQuote[] = cespiti.map((c) => ({
    id: c.id,
    descrizione: c.descrizione,
    dataAcquisto: c.dataAcquisto,
    annoInizio: c.annoInizio,
    valoreIniziale: Number(c.valoreIniziale),
    aliquotaAmmortamento: Number(c.aliquotaAmmortamento),
    stato: c.stato,
    quoteAmmortamento: c.quoteAmmortamento.map((q) => ({
      anno: q.anno,
      importoQuota: Number(q.importoQuota),
      fondoProgressivo: Number(q.fondoProgressivo),
      importoQuotaFiscale: q.importoQuotaFiscale ? Number(q.importoQuotaFiscale) : null,
      fondoProgressivoFiscale: q.fondoProgressivoFiscale ? Number(q.fondoProgressivoFiscale) : null,
    })),
    veicolo: c.veicolo,
  }));

  return calcolaRegistro(mapped, anno, societaId);
}
