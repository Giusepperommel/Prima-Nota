// src/lib/bi/comparativa/budget.ts
import { prisma } from "@/lib/prisma";
import type { ComparisonRow } from "../types";
import { buildComparisonRow } from "./periodo";

export const buildBudgetComparisonRow = buildComparisonRow;

export async function compareBudgetVsActual(
  societaId: number,
  budgetId: number,
  mese: number
): Promise<{ righe: ComparisonRow[]; totaleScostamento: number }> {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, societaId },
    include: {
      righe: {
        where: { mese },
        include: { conto: { select: { id: true, descrizione: true, tipo: true } } },
      },
    },
  });

  if (!budget) return { righe: [], totaleScostamento: 0 };

  const anno = budget.anno;
  const righe: ComparisonRow[] = [];
  let totaleScostamento = 0;

  for (const riga of budget.righe) {
    // Get actual from MovimentoContabile for this account and month
    const movimenti = await prisma.movimentoContabile.aggregate({
      where: {
        societaId,
        contoId: riga.contoId,
        scrittura: {
          dataRegistrazione: {
            gte: new Date(anno, mese - 1, 1),
            lt: new Date(anno, mese, 1),
          },
          stato: "DEFINITIVA",
        },
      },
      _sum: { importoDare: true, importoAvere: true },
    });

    const dare = Number(movimenti._sum.importoDare ?? 0);
    const avere = Number(movimenti._sum.importoAvere ?? 0);
    const actual = riga.conto.tipo === "ECONOMICO_COSTO" ? dare - avere : avere - dare;
    const budgetVal = Number(riga.importo);

    const row = buildBudgetComparisonRow(riga.conto.descrizione, actual, budgetVal);
    righe.push(row);
    totaleScostamento += row.delta;
  }

  return { righe, totaleScostamento };
}
