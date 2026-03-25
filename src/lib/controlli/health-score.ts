import { prisma } from "@/lib/prisma";
import type { AnomaliaTipo } from "@prisma/client";

type HealthScoreResult = {
  areaContabilita: number;
  areaIva: number;
  areaScadenze: number;
  areaDocumentale: number;
  areaBanca: number;
  scoreComplessivo: number;
};

const AREA_TIPO_MAP: Record<string, AnomaliaTipo[]> = {
  contabilita: ["QUADRATURA", "DUPLICATO", "INCOERENZA_SEMANTICA"],
  iva: ["COMPLIANCE", "REGIME_IVA_SOSPETTO"],
  scadenze: ["SCADENZA"],
  documentale: ["DOCUMENTALE", "CATEGORIA_ANOMALA"],
  banca: [],  // No specific anomaly types yet; score based on reconciliation %
};

const PRIORITY_PENALTY = { CRITICA: 25, ALTA: 10, MEDIA: 5, BASSA: 2 };

async function calculateAreaScore(
  societaId: number,
  tipi: AnomaliaTipo[],
): Promise<number> {
  if (tipi.length === 0) return 100;

  let penalty = 0;
  for (const priorita of ["CRITICA", "ALTA"] as const) {
    const count = await prisma.anomalia.count({
      where: { societaId, tipo: { in: tipi }, stato: "APERTA", priorita },
    });
    penalty += count * PRIORITY_PENALTY[priorita];
  }

  return Math.max(0, 100 - penalty);
}

export async function calculateHealthScore(
  societaId: number,
  anno: number,
  mese: number,
): Promise<HealthScoreResult> {
  const areaContabilita = await calculateAreaScore(societaId, AREA_TIPO_MAP.contabilita);
  const areaIva = await calculateAreaScore(societaId, AREA_TIPO_MAP.iva);
  const areaScadenze = await calculateAreaScore(societaId, AREA_TIPO_MAP.scadenze);
  const areaDocumentale = await calculateAreaScore(societaId, AREA_TIPO_MAP.documentale);
  const areaBanca = await calculateAreaScore(societaId, AREA_TIPO_MAP.banca);

  const scoreComplessivo = Math.round(
    (areaContabilita + areaIva + areaScadenze + areaDocumentale + areaBanca) / 5,
  );

  await prisma.healthScore.upsert({
    where: { societaId_anno_mese: { societaId, anno, mese } },
    update: {
      areaContabilita, areaIva, areaScadenze, areaDocumentale, areaBanca,
      scoreComplessivo, calcolatoAt: new Date(),
    },
    create: {
      societaId, anno, mese,
      areaContabilita, areaIva, areaScadenze, areaDocumentale, areaBanca,
      scoreComplessivo, calcolatoAt: new Date(),
    },
  });

  return { areaContabilita, areaIva, areaScadenze, areaDocumentale, areaBanca, scoreComplessivo };
}
