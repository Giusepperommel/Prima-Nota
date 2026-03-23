import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const scadenzaId = parseInt(id, 10);

    if (isNaN(scadenzaId)) {
      return NextResponse.json(
        { error: "ID scadenza non valido" },
        { status: 400 }
      );
    }

    const existing = await prisma.scadenzaAzienda.findFirst({
      where: { id: scadenzaId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scadenza non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { descrizione, dataScadenza, tipoScadenza, priorita, completata } = body;

    const data: any = {};

    if (descrizione !== undefined) data.descrizione = descrizione;
    if (dataScadenza !== undefined) data.dataScadenza = new Date(dataScadenza);
    if (tipoScadenza !== undefined) data.tipoScadenza = tipoScadenza;
    if (priorita !== undefined) data.priorita = priorita;

    if (completata !== undefined) {
      data.completata = completata;
      if (completata && !existing.completata) {
        data.dataCompletamento = new Date();
      } else if (!completata) {
        data.dataCompletamento = null;
      }
    }

    const scadenza = await prisma.scadenzaAzienda.update({
      where: { id: scadenzaId },
      data,
    });

    return NextResponse.json({
      ...scadenza,
      dataScadenza: scadenza.dataScadenza.toISOString().split("T")[0],
      dataCompletamento: scadenza.dataCompletamento?.toISOString() ?? null,
      createdAt: scadenza.createdAt.toISOString(),
      updatedAt: scadenza.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento della scadenza:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const scadenzaId = parseInt(id, 10);

    if (isNaN(scadenzaId)) {
      return NextResponse.json(
        { error: "ID scadenza non valido" },
        { status: 400 }
      );
    }

    const existing = await prisma.scadenzaAzienda.findFirst({
      where: { id: scadenzaId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scadenza non trovata" },
        { status: 404 }
      );
    }

    await prisma.scadenzaAzienda.delete({
      where: { id: scadenzaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione della scadenza:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
