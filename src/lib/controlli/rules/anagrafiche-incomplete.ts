import { prisma } from "@/lib/prisma";
import type { CheckResult } from "../types";

export async function checkAnagraficheIncomplete(societaId: number, _anno: number): Promise<CheckResult> {
  const incomplete = await prisma.anagrafica.findMany({
    where: {
      societaId,
      OR: [
        { partitaIva: "" },
        { partitaIva: null },
        { codiceFiscale: "" },
        { codiceFiscale: null },
      ],
    },
    select: { id: true, denominazione: true, partitaIva: true, codiceFiscale: true },
  });

  const anomalie = incomplete.map((a) => ({
    tipo: "DOCUMENTALE" as const,
    sorgente: "REGOLA" as const,
    priorita: "MEDIA" as const,
    titolo: `Anagrafica incompleta: ${a.denominazione}`,
    descrizione: `Manca${!a.partitaIva ? " P.IVA" : ""}${!a.codiceFiscale ? " Codice Fiscale" : ""}`,
    entityType: "Anagrafica",
    entityId: a.id,
  }));

  return { found: anomalie.length > 0, anomalie };
}
