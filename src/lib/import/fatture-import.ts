import { prisma } from "@/lib/prisma";
import type { FatturaImportata } from "@/lib/providers/types";
import type { ImportResult, ImportDetail } from "./types";
import { buildFatturaKey, checkDuplicateFattura } from "./idempotency";
import { classificaFattura } from "./fatture-classifier";

export async function importaFattureXml(
  societaId: number,
  userId: number,
  fatture: FatturaImportata[],
): Promise<ImportResult> {
  const result: ImportResult = {
    totali: fatture.length,
    importate: 0,
    duplicate: 0,
    errori: 0,
    bozzeCreate: 0,
    dettagli: [],
  };

  for (const fattura of fatture) {
    const detail: ImportDetail = {
      nomeFile: fattura.nomeFile ?? fattura.numeroFattura,
      stato: "IMPORTATA",
      fornitoreNoto: false,
    };

    try {
      // Check idempotency
      const chiaveImport = buildFatturaKey({
        identificativoSdi: fattura.identificativoSdi,
        nomeFile: fattura.nomeFile,
        fornitorePartitaIva: fattura.cedente.partitaIva,
        numeroFattura: fattura.numeroFattura,
        dataFattura: fattura.dataFattura.toISOString().split("T")[0],
      });

      if (await checkDuplicateFattura(societaId, chiaveImport)) {
        detail.stato = "DUPLICATA";
        result.duplicate++;
        result.dettagli.push(detail);
        continue;
      }

      // Classify
      const classificazione = await classificaFattura(societaId, {
        cedente: fattura.cedente,
        importoTotale: fattura.importoTotale,
        righeDescrizione: fattura.righe.map((r) => r.descrizione).join("; "),
      });

      detail.confidence = classificazione.confidence;
      detail.fornitoreNoto = !classificazione.fornitoreNuovo;

      // Ensure fornitore exists (create if new)
      let fornitoreId = classificazione.fornitoreId;
      if (!fornitoreId && fattura.cedente.partitaIva) {
        const newAnagrafica = await prisma.anagrafica.create({
          data: {
            societaId,
            denominazione: fattura.cedente.denominazione,
            partitaIva: fattura.cedente.partitaIva,
            codiceFiscale: fattura.cedente.codiceFiscale ?? "",
            tipo: "FORNITORE",
            tipoSoggetto: "AZIENDA",
            nazione: fattura.cedente.nazione,
            autoCreataOcr: true,
          },
        });
        fornitoreId = newAnagrafica.id;
      }

      // Get default categoria and soci for ripartizione
      const defaultCategoria = classificazione.categoriaId
        ? await prisma.categoriaSpesa.findFirst({ where: { id: classificazione.categoriaId } })
        : await prisma.categoriaSpesa.findFirst({ where: { societaId } });

      const soci = await prisma.socio.findMany({
        where: { societaId, attivo: true },
        select: { id: true, quotaPercentuale: true },
      });

      // Create bozza operazione
      const operazione = await prisma.operazione.create({
        data: {
          societaId,
          tipoOperazione: "COSTO",
          dataOperazione: fattura.dataFattura,
          dataRegistrazione: fattura.dataFattura,
          descrizione: fattura.righe.map((r) => r.descrizione).join("; ").slice(0, 500) || fattura.numeroFattura,
          importoTotale: fattura.importoTotale,
          importoImponibile: fattura.imponibile,
          importoIva: fattura.iva,
          aliquotaIva: fattura.aliquotaIva,
          numeroDocumento: fattura.numeroFattura,
          categoriaId: defaultCategoria?.id,
          fornitoreId,
          codiceContoId: classificazione.codiceContoId,
          tipoRipartizione: "COMUNE",
          importoDeducibile: fattura.importoTotale * ((defaultCategoria as any)?.percentualeDeducibilita ?? 100) / 100,
          percentualeDeducibilita: (defaultCategoria as any)?.percentualeDeducibilita ?? 100,
          bozza: true,
          chiaveImport,
          sorgente: "XML_IMPORT",
          aiConfidence: classificazione.confidence,
          registroIva: "ACQUISTI",
          createdByUserId: userId,
        },
      });

      // Create ripartizioni
      if (soci.length > 0) {
        await prisma.ripartizioneOperazione.createMany({
          data: soci.map((socio) => ({
            operazioneId: operazione.id,
            socioId: socio.id,
            percentuale: Number(socio.quotaPercentuale),
            importoCalcolato: Math.round((fattura.importoTotale * Number(socio.quotaPercentuale)) / 100 * 100) / 100,
          })),
        });
      }

      detail.bozzaId = operazione.id;
      result.importate++;
      result.bozzeCreate++;
    } catch (error: any) {
      detail.stato = "ERRORE";
      detail.errore = error?.message ?? "Errore sconosciuto";
      result.errori++;
    }

    result.dettagli.push(detail);
  }

  return result;
}
