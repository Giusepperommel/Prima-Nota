import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_FIELDS = [
  "saldoBancaIniziale",
  "saldoCassaIniziale",
  "capitaleSociale",
  "riservaLegale",
  "riservaStatutaria",
  "riservaEstraordinaria",
  "utiliPerditePortatiANuovo",
  "saldoBancaFinale",
  "saldoCassaFinale",
] as const;

export async function PATCH(
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

    // Build update data with only allowed fields
    const updateData: Record<string, number> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        const val = parseFloat(String(body[field]));
        if (isNaN(val)) {
          return NextResponse.json(
            { error: `Valore non valido per ${field}` },
            { status: 400 }
          );
        }
        updateData[field] = val;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nessun campo valido da aggiornare" },
        { status: 400 }
      );
    }

    const updated = await prisma.chiusuraEsercizio.update({
      where: { societaId_anno: { societaId, anno } },
      data: updateData,
    });

    const serializeDecimal = (val: any) => (val != null ? Number(val) : null);

    return NextResponse.json({
      ...updated,
      capitaleSociale: serializeDecimal(updated.capitaleSociale),
      saldoBancaIniziale: serializeDecimal(updated.saldoBancaIniziale),
      saldoCassaIniziale: serializeDecimal(updated.saldoCassaIniziale),
      riservaLegale: serializeDecimal(updated.riservaLegale),
      riservaStatutaria: serializeDecimal(updated.riservaStatutaria),
      riservaEstraordinaria: serializeDecimal(updated.riservaEstraordinaria),
      utiliPerditePortatiANuovo: serializeDecimal(updated.utiliPerditePortatiANuovo),
      saldoBancaFinale: serializeDecimal(updated.saldoBancaFinale),
      saldoCassaFinale: serializeDecimal(updated.saldoCassaFinale),
      risultatoEsercizio: serializeDecimal(updated.risultatoEsercizio),
      dataApertura: updated.dataApertura.toISOString(),
      dataChiusura: updated.dataChiusura.toISOString(),
      dataCreazione: updated.dataCreazione.toISOString(),
      dataChiusuraEffettiva: updated.dataChiusuraEffettiva?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento saldi:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
