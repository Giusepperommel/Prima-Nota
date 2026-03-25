import { prisma } from "@/lib/prisma";
import { getAllChecks } from "./catalog";

type RunResult = {
  checksEseguiti: number;
  anomalieTrovate: number;
  anomalieCreate: number;
  errori: number;
};

export async function runAllChecks(societaId: number, anno: number): Promise<RunResult> {
  const checks = getAllChecks();
  const result: RunResult = { checksEseguiti: 0, anomalieTrovate: 0, anomalieCreate: 0, errori: 0 };

  for (const check of checks) {
    try {
      const checkResult = await check.run(societaId, anno);
      result.checksEseguiti++;

      for (const anomalia of checkResult.anomalie) {
        result.anomalieTrovate++;

        // Skip if same anomaly already exists and is open
        const existing = await prisma.anomalia.findFirst({
          where: {
            societaId,
            tipo: anomalia.tipo,
            entityType: anomalia.entityType ?? null,
            entityId: anomalia.entityId ?? null,
            stato: "APERTA",
          },
        });

        if (!existing) {
          await prisma.anomalia.create({
            data: {
              societaId,
              tipo: anomalia.tipo,
              sorgente: anomalia.sorgente,
              priorita: anomalia.priorita,
              titolo: anomalia.titolo,
              descrizione: anomalia.descrizione,
              entityType: anomalia.entityType,
              entityId: anomalia.entityId,
              metadati: anomalia.metadati as any,
            },
          });
          result.anomalieCreate++;
        }
      }
    } catch (error) {
      console.error(`Check ${check.id} failed:`, error);
      result.errori++;
    }
  }

  return result;
}
