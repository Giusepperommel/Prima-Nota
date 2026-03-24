import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna societa selezionata" },
        { status: 400 }
      );
    }

    const sezionali = await prisma.sezionaleFattura.findMany({
      where: { societaId },
      orderBy: [{ predefinito: "desc" }, { codice: "asc" }],
    });

    const serialized = sezionali.map((s) => ({
      id: s.id,
      codice: s.codice,
      descrizione: s.descrizione,
      prefisso: s.prefisso,
      separatore: s.separatore,
      tipiDocumento: s.tipiDocumento,
      ultimoNumero: s.ultimoNumero,
      numeroIniziale: s.numeroIniziale,
      annoCorrente: s.annoCorrente,
      paddingCifre: s.paddingCifre,
      attivo: s.attivo,
      predefinito: s.predefinito,
    }));

    return NextResponse.json({ sezionali: serialized });
  } catch (error: any) {
    console.error("Errore lista sezionali:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dei sezionali" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna societa selezionata" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      codice,
      descrizione,
      prefisso,
      separatore = "/",
      tipiDocumento = ["TD01"],
      paddingCifre = 1,
      predefinito = false,
    } = body;

    if (!codice || !descrizione || !prefisso) {
      return NextResponse.json(
        { error: "Codice, descrizione e prefisso sono obbligatori" },
        { status: 400 }
      );
    }

    // If setting as predefinito, unset others
    if (predefinito) {
      await prisma.sezionaleFattura.updateMany({
        where: { societaId, predefinito: true },
        data: { predefinito: false },
      });
    }

    const sezionale = await prisma.sezionaleFattura.create({
      data: {
        societaId,
        codice,
        descrizione,
        prefisso,
        separatore,
        tipiDocumento,
        paddingCifre,
        annoCorrente: new Date().getFullYear(),
        predefinito,
      },
    });

    return NextResponse.json({ sezionale }, { status: 201 });
  } catch (error: any) {
    console.error("Errore creazione sezionale:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Esiste gia un sezionale con questo codice" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Errore nella creazione del sezionale" },
      { status: 500 }
    );
  }
}
