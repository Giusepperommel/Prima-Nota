import { prisma } from "@/lib/prisma";
import { classifyWithClaude } from "@/lib/ai/classifier";
import type { ClassificazioneResult } from "./types";

type FatturaClassInput = {
  cedente: { denominazione: string; partitaIva?: string; nazione: string };
  importoTotale: number;
  righeDescrizione: string;
};

export async function classificaFattura(
  societaId: number,
  input: FatturaClassInput,
): Promise<ClassificazioneResult> {
  // Step 1: Check if supplier is known
  const anagrafica = input.cedente.partitaIva
    ? await prisma.anagrafica.findFirst({
        where: { societaId, partitaIva: input.cedente.partitaIva },
      })
    : null;

  if (anagrafica) {
    // Known supplier: use last used category
    const lastOp = await prisma.operazione.findFirst({
      where: { societaId, fornitoreId: anagrafica.id, bozza: false },
      orderBy: { dataOperazione: "desc" },
      select: { categoriaId: true, codiceContoId: true },
    });

    if (lastOp?.categoriaId) {
      return {
        categoriaId: lastOp.categoriaId,
        codiceContoId: lastOp.codiceContoId,
        tipoOperazione: "COSTO",
        fornitoreId: anagrafica.id,
        fornitoreNuovo: false,
        confidence: 0.95,
        motivazione: `Fornitore noto: ${anagrafica.denominazione}. Categoria dall'ultima operazione.`,
      };
    }

    // Known supplier but no previous operations
    return {
      categoriaId: null,
      codiceContoId: null,
      tipoOperazione: "COSTO",
      fornitoreId: anagrafica.id,
      fornitoreNuovo: false,
      confidence: 0.5,
      motivazione: `Fornitore noto ma nessuna operazione precedente. Classificazione manuale richiesta.`,
    };
  }

  // Step 2: New supplier — try AI classification
  const categorie = await prisma.categoriaSpesa.findMany({
    where: { societaId },
    select: { id: true, nome: true },
  });

  try {
    const aiResult = await classifyWithClaude("CLASSIFICAZIONE", {
      fornitore: input.cedente.denominazione,
      descrizione: input.righeDescrizione,
      importo: input.importoTotale,
      categorie,
    });

    const suggestion = aiResult.suggestion as Record<string, unknown>;
    return {
      categoriaId: (typeof suggestion.categoriaId === "number" ? suggestion.categoriaId : null),
      codiceContoId: (typeof suggestion.contoId === "number" ? suggestion.contoId : null),
      tipoOperazione: "COSTO",
      fornitoreId: null,
      fornitoreNuovo: true,
      confidence: aiResult.confidence,
      motivazione: aiResult.motivazione,
    };
  } catch {
    // AI unavailable — return unclassified
    return {
      categoriaId: null,
      codiceContoId: null,
      tipoOperazione: "COSTO",
      fornitoreId: null,
      fornitoreNuovo: true,
      confidence: 0,
      motivazione: "Fornitore nuovo, classificazione AI non disponibile.",
    };
  }
}
