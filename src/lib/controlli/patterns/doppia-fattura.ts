import { prisma } from "@/lib/prisma";
import type { CheckResult } from "../types";

export async function checkDoppiaFattura(societaId: number, anno: number): Promise<CheckResult> {
  const operazioni = await prisma.operazione.findMany({
    where: {
      societaId,
      tipoOperazione: "COSTO",
      dataOperazione: { gte: new Date(`${anno}-01-01`), lte: new Date(`${anno}-12-31`) },
      fornitoreId: { not: null },
      bozza: false,
      eliminato: false,
    },
    select: { id: true, fornitoreId: true, importoTotale: true, dataOperazione: true, numeroDocumento: true, descrizione: true },
    orderBy: [{ fornitoreId: "asc" }, { dataOperazione: "asc" }],
  });

  const anomalie = [];
  for (let i = 0; i < operazioni.length - 1; i++) {
    for (let j = i + 1; j < operazioni.length; j++) {
      const a = operazioni[i];
      const b = operazioni[j];
      if (
        a.fornitoreId === b.fornitoreId &&
        Math.abs(Number(a.importoTotale) - Number(b.importoTotale)) < 0.01 &&
        Math.abs(a.dataOperazione.getTime() - b.dataOperazione.getTime()) < 86400000 // 1 day
      ) {
        anomalie.push({
          tipo: "DUPLICATO" as const,
          sorgente: "PATTERN" as const,
          priorita: "ALTA" as const,
          titolo: `Possibile duplicato: ${a.numeroDocumento ?? a.descrizione} / ${b.numeroDocumento ?? b.descrizione}`,
          descrizione: `Stesso fornitore, importo \u20AC${Number(a.importoTotale).toFixed(2)}, date ravvicinate`,
          entityType: "Operazione",
          entityId: a.id,
          metadati: { operazioneIdA: a.id, operazioneIdB: b.id },
        });
      }
    }
  }

  return { found: anomalie.length > 0, anomalie };
}
