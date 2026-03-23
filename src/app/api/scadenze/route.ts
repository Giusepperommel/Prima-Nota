import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const completata = searchParams.get("completata");
    const tipoScadenza = searchParams.get("tipoScadenza");

    const where: any = { societaId };

    if (completata !== null && completata !== "") {
      where.completata = completata === "true";
    }

    if (tipoScadenza) {
      where.tipoScadenza = tipoScadenza;
    }

    const scadenze = await prisma.scadenzaAzienda.findMany({
      where,
      orderBy: { dataScadenza: "asc" },
      include: {
        createdBy: {
          select: { id: true, nome: true, cognome: true },
        },
      },
    });

    const serialized = scadenze.map((s) => ({
      ...s,
      dataScadenza: s.dataScadenza.toISOString().split("T")[0],
      dataCompletamento: s.dataCompletamento?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero delle scadenze:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { descrizione, dataScadenza, tipoScadenza, priorita } = body;

    if (!descrizione || !dataScadenza || !tipoScadenza || !priorita) {
      return NextResponse.json(
        { error: "descrizione, dataScadenza, tipoScadenza e priorita sono obbligatori" },
        { status: 400 }
      );
    }

    const validTipi = ["FISCALE", "CONTABILE", "GENERICA"];
    if (!validTipi.includes(tipoScadenza)) {
      return NextResponse.json(
        { error: "tipoScadenza non valido" },
        { status: 400 }
      );
    }

    const validPriorita = ["ALTA", "MEDIA", "BASSA"];
    if (!validPriorita.includes(priorita)) {
      return NextResponse.json(
        { error: "priorita non valida" },
        { status: 400 }
      );
    }

    const scadenza = await prisma.scadenzaAzienda.create({
      data: {
        societaId,
        createdByUtenteId: user.id,
        descrizione,
        dataScadenza: new Date(dataScadenza),
        tipoScadenza,
        priorita,
      },
    });

    return NextResponse.json(
      {
        ...scadenza,
        dataScadenza: scadenza.dataScadenza.toISOString().split("T")[0],
        dataCompletamento: null,
        createdAt: scadenza.createdAt.toISOString(),
        updatedAt: scadenza.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione della scadenza:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
