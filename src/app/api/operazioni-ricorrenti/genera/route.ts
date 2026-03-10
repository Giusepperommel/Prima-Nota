import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaRipartizione } from "@/lib/business-utils";
import {
  calcolaDataEffettiva,
  calcolaProssimaGenerazione,
} from "@/lib/calcoli-ricorrenze";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    // Find all active recurring operations due for generation
    const ricorrenti = await prisma.operazioneRicorrente.findMany({
      where: {
        societaId,
        attiva: true,
        prossimaGenerazione: { lte: oggi },
      },
    });

    if (ricorrenti.length === 0) {
      return NextResponse.json({ bozzeGenerate: 0, ids: [] });
    }

    // Get active soci for ripartizione calculations
    const soci = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { id: true, quotaPercentuale: true },
    });

    const sociForCalc = soci.map((s) => ({
      id: s.id,
      quotaPercentuale: Number(s.quotaPercentuale),
    }));

    const bozzeIds: number[] = [];

    for (const ric of ricorrenti) {
      let prossimaGen = new Date(ric.prossimaGenerazione);
      let rateRimanenti = ric.rateRimanenti;

      // Loop to generate drafts for all missed months
      while (prossimaGen <= oggi) {
        // If rateRimanenti reached 0, stop generating
        if (rateRimanenti !== null && rateRimanenti <= 0) {
          break;
        }

        const mese = prossimaGen.getMonth();
        const anno = prossimaGen.getFullYear();
        const dataEffettiva = calcolaDataEffettiva(
          ric.giornoDelMese,
          mese,
          anno
        );

        // Check for duplicate: same ricorrenteId + same date
        const esistente = await prisma.operazione.findFirst({
          where: {
            operazioneRicorrenteId: ric.id,
            dataOperazione: dataEffettiva,
            eliminato: false,
          },
        });

        if (!esistente) {
          // Calculate ripartizioni for this draft
          const ripartizioniCalcolate = calcolaRipartizione(
            Number(ric.importoTotale),
            ric.tipoRipartizione as "COMUNE" | "SINGOLO" | "CUSTOM",
            sociForCalc,
            ric.socioSingoloId ?? undefined
          );

          // Create draft operation with ripartizioni in a transaction
          const bozza = await prisma.$transaction(async (tx) => {
            const op = await tx.operazione.create({
              data: {
                societaId,
                tipoOperazione: ric.tipoOperazione,
                dataOperazione: dataEffettiva,
                descrizione: ric.descrizione,
                importoTotale: Number(ric.importoTotale),
                aliquotaIva: ric.aliquotaIva != null ? Number(ric.aliquotaIva) : null,
                importoImponibile: ric.importoImponibile != null ? Number(ric.importoImponibile) : null,
                importoIva: ric.importoIva != null ? Number(ric.importoIva) : null,
                percentualeDetraibilitaIva: ric.percentualeDetraibilitaIva != null ? Number(ric.percentualeDetraibilitaIva) : null,
                ivaDetraibile: ric.ivaDetraibile != null ? Number(ric.ivaDetraibile) : null,
                ivaIndetraibile: ric.ivaIndetraibile != null ? Number(ric.ivaIndetraibile) : null,
                opzioneUso: ric.opzioneUso,
                categoriaId: ric.categoriaId,
                importoDeducibile: Number(ric.importoDeducibile),
                percentualeDeducibilita: Number(ric.percentualeDeducibilita),
                deducibilitaCustom: ric.deducibilitaCustom,
                tipoRipartizione: ric.tipoRipartizione,
                note: ric.note,
                bozza: true,
                operazioneRicorrenteId: ric.id,
                createdByUserId: userId,
              },
            });

            await tx.ripartizioneOperazione.createMany({
              data: ripartizioniCalcolate.map((rip) => ({
                operazioneId: op.id,
                socioId: rip.socioId,
                percentuale: rip.percentuale,
                importoCalcolato: rip.importo,
              })),
            });

            return op;
          });

          bozzeIds.push(bozza.id);
        }

        // Decrement rateRimanenti if applicable
        if (rateRimanenti !== null) {
          rateRimanenti = rateRimanenti - 1;
        }

        // Advance to next month
        prossimaGen = calcolaProssimaGenerazione(
          ric.giornoDelMese,
          prossimaGen
        );
      }

      // Update the recurring operation after processing all missed months
      const updateData: {
        prossimaGenerazione: Date;
        rateRimanenti?: number | null;
        attiva?: boolean;
      } = {
        prossimaGenerazione: prossimaGen,
      };

      if (ric.rateRimanenti !== null) {
        updateData.rateRimanenti = rateRimanenti;
        if (rateRimanenti !== null && rateRimanenti <= 0) {
          updateData.attiva = false;
        }
      }

      if (ric.dataFine && prossimaGen > new Date(ric.dataFine)) {
        updateData.attiva = false;
      }

      await prisma.operazioneRicorrente.update({
        where: { id: ric.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      bozzeGenerate: bozzeIds.length,
      ids: bozzeIds,
    });
  } catch (error) {
    console.error(
      "Errore nella generazione delle bozze ricorrenti:",
      error
    );
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
