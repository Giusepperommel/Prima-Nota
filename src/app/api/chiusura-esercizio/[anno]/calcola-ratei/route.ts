import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ anno: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { anno: annoParam } = await context.params;
    const anno = parseInt(annoParam, 10);

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const chiusura = await prisma.chiusuraEsercizio.findUnique({
      where: { societaId_anno: { societaId, anno } },
    });

    if (!chiusura) {
      return NextResponse.json(
        { error: `Chiusura esercizio per l'anno ${anno} non trovata` },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Mode 1: Calculate proposed ratei/risconti
    if (body.calcola === true) {
      const fineAnno = new Date(anno, 11, 31);

      // Find operations with competence that spans beyond year end
      const operazioni = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          dataCompetenzaFine: { gt: fineAnno },
          dataCompetenzaInizio: { lte: fineAnno },
        },
        select: {
          id: true,
          tipoOperazione: true,
          descrizione: true,
          importoTotale: true,
          dataCompetenzaInizio: true,
          dataCompetenzaFine: true,
          dataOperazione: true,
        },
      });

      const proposte = operazioni.map((op) => {
        const inizio = new Date(op.dataCompetenzaInizio!);
        const fine = new Date(op.dataCompetenzaFine!);
        const importoTotale = Number(op.importoTotale);

        const giorniTotali = Math.ceil(
          (fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

        const giorniFuturi = Math.ceil(
          (fine.getTime() - fineAnno.getTime()) / (1000 * 60 * 60 * 24)
        );

        const importoCalcolato =
          Math.round(((importoTotale / giorniTotali) * giorniFuturi) * 100) / 100;

        // Determine tipo
        const isCosto = op.tipoOperazione === "COSTO" || op.tipoOperazione === "CESPITE";
        const isRicavo = op.tipoOperazione === "FATTURA_ATTIVA";

        let tipo: string;
        if (isCosto) {
          // Cost with competence extending beyond year end = prepaid cost
          tipo = "RISCONTO_ATTIVO";
        } else if (isRicavo) {
          // Revenue with competence extending beyond year end = deferred revenue
          tipo = "RISCONTO_PASSIVO";
        } else {
          // Default for other types
          tipo = "RISCONTO_ATTIVO";
        }

        // Determine voceSp
        const voceSp = tipo === "RISCONTO_ATTIVO" || tipo === "RATEO_ATTIVO" ? "D" : "E";

        return {
          operazioneId: op.id,
          tipo,
          descrizione: op.descrizione,
          importoOriginario: importoTotale,
          dataInizioCompetenza: inizio.toISOString(),
          dataFineCompetenza: fine.toISOString(),
          dataManifestazioneFin: op.dataOperazione.toISOString(),
          importoCalcolato,
          giorniTotali,
          giorniFuturi,
          voceSp,
        };
      });

      return NextResponse.json({ proposte });
    }

    // Mode 2: Confirm and save ratei/risconti
    if (body.conferma === true && Array.isArray(body.rateiRisconti)) {
      const rateiRisconti = body.rateiRisconti;

      const created = await prisma.$transaction(async (tx) => {
        const records = [];
        for (const rr of rateiRisconti) {
          const record = await tx.rateoRisconto.create({
            data: {
              societaId,
              chiusuraEsercizioId: chiusura.id,
              tipo: rr.tipo,
              descrizione: rr.descrizione,
              importoOriginario: parseFloat(String(rr.importoOriginario)),
              dataInizioCompetenza: new Date(rr.dataInizioCompetenza),
              dataFineCompetenza: new Date(rr.dataFineCompetenza),
              dataManifestazioneFin: new Date(rr.dataManifestazioneFin),
              importoCalcolato: parseFloat(String(rr.importoCalcolato)),
              esercizioRiferimento: anno,
              voceSp: rr.voceSp || null,
              contoCeCollegato: rr.contoCeCollegato || null,
              automatico: true,
            },
          });
          records.push(record);
        }
        return records;
      });

      const serialized = created.map((rr) => ({
        ...rr,
        importoOriginario: Number(rr.importoOriginario),
        importoCalcolato: Number(rr.importoCalcolato),
        dataInizioCompetenza: rr.dataInizioCompetenza.toISOString(),
        dataFineCompetenza: rr.dataFineCompetenza.toISOString(),
        dataManifestazioneFin: rr.dataManifestazioneFin.toISOString(),
        createdAt: rr.createdAt.toISOString(),
      }));

      return NextResponse.json({ rateiRisconti: serialized }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Specificare { calcola: true } oppure { conferma: true, rateiRisconti: [...] }" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Errore nel calcolo ratei/risconti:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
