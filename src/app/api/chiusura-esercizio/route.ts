import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { anno } = body;

    if (!anno || typeof anno !== "number" || anno < 2000 || anno > 2100) {
      return NextResponse.json(
        { error: "Anno non valido" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.chiusuraEsercizio.findUnique({
      where: { societaId_anno: { societaId, anno } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Chiusura esercizio per l'anno ${anno} già esistente` },
        { status: 409 }
      );
    }

    // Get capitaleSociale from Societa
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { capitaleSociale: true },
    });

    const chiusura = await prisma.chiusuraEsercizio.create({
      data: {
        societaId,
        anno,
        dataApertura: new Date(anno, 0, 1),
        dataChiusura: new Date(anno, 11, 31),
        capitaleSociale: societa?.capitaleSociale
          ? Number(societa.capitaleSociale)
          : null,
      },
    });

    return NextResponse.json(
      {
        ...chiusura,
        capitaleSociale: chiusura.capitaleSociale != null ? Number(chiusura.capitaleSociale) : null,
        saldoBancaIniziale: chiusura.saldoBancaIniziale != null ? Number(chiusura.saldoBancaIniziale) : null,
        saldoCassaIniziale: chiusura.saldoCassaIniziale != null ? Number(chiusura.saldoCassaIniziale) : null,
        riservaLegale: chiusura.riservaLegale != null ? Number(chiusura.riservaLegale) : null,
        riservaStatutaria: chiusura.riservaStatutaria != null ? Number(chiusura.riservaStatutaria) : null,
        riservaEstraordinaria: chiusura.riservaEstraordinaria != null ? Number(chiusura.riservaEstraordinaria) : null,
        utiliPerditePortatiANuovo: chiusura.utiliPerditePortatiANuovo != null ? Number(chiusura.utiliPerditePortatiANuovo) : null,
        saldoBancaFinale: chiusura.saldoBancaFinale != null ? Number(chiusura.saldoBancaFinale) : null,
        saldoCassaFinale: chiusura.saldoCassaFinale != null ? Number(chiusura.saldoCassaFinale) : null,
        risultatoEsercizio: chiusura.risultatoEsercizio != null ? Number(chiusura.risultatoEsercizio) : null,
        dataApertura: chiusura.dataApertura.toISOString(),
        dataChiusura: chiusura.dataChiusura.toISOString(),
        dataCreazione: chiusura.dataCreazione.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione chiusura esercizio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
