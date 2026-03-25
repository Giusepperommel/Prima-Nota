import { prisma } from "@/lib/prisma";
import type { CheckResult } from "../types";

export async function checkDareAvere(societaId: number, anno: number): Promise<CheckResult> {
  const scritture = await prisma.scritturaContabile.findMany({
    where: {
      societaId,
      dataRegistrazione: {
        gte: new Date(`${anno}-01-01`),
        lte: new Date(`${anno}-12-31`),
      },
      eliminato: false,
    },
    include: { movimenti: { select: { importoDare: true, importoAvere: true } } },
  });

  const anomalie = [];
  for (const s of scritture) {
    const dare = s.movimenti.reduce(
      (sum: number, m: any) => sum + Number(m.importoDare),
      0,
    );
    const avere = s.movimenti.reduce(
      (sum: number, m: any) => sum + Number(m.importoAvere),
      0,
    );

    if (Math.abs(dare - avere) > 0.01) {
      anomalie.push({
        tipo: "QUADRATURA" as const,
        sorgente: "REGOLA" as const,
        priorita: "CRITICA" as const,
        titolo: `Scrittura non bilanciata: ${s.descrizione}`,
        descrizione: `Dare: \u20AC${dare.toFixed(2)}, Avere: \u20AC${avere.toFixed(2)}, Differenza: \u20AC${Math.abs(dare - avere).toFixed(2)}`,
        entityType: "ScritturaContabile",
        entityId: s.id,
        metadati: { dare, avere, differenza: Math.abs(dare - avere) },
      });
    }
  }

  return { found: anomalie.length > 0, anomalie };
}
