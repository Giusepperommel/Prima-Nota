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
    const notaId = parseInt(id, 10);

    if (isNaN(notaId)) {
      return NextResponse.json(
        { error: "ID nota non valido" },
        { status: 400 }
      );
    }

    // Verify ownership: note belongs to this user's UtenteAzienda
    const utenteAzienda = await prisma.utenteAzienda.findUnique({
      where: { utenteId_societaId: { utenteId: user.id, societaId } },
    });

    if (!utenteAzienda) {
      return NextResponse.json(
        { error: "Accesso all'azienda non trovato" },
        { status: 404 }
      );
    }

    const existing = await prisma.notaAzienda.findFirst({
      where: { id: notaId, utenteAziendaId: utenteAzienda.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Nota non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { testo, colore } = body;

    const data: any = {};
    if (testo !== undefined) data.testo = testo;
    if (colore !== undefined) data.colore = colore;

    const nota = await prisma.notaAzienda.update({
      where: { id: notaId },
      data,
    });

    return NextResponse.json({
      ...nota,
      createdAt: nota.createdAt.toISOString(),
      updatedAt: nota.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento della nota:", error);
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
    const notaId = parseInt(id, 10);

    if (isNaN(notaId)) {
      return NextResponse.json(
        { error: "ID nota non valido" },
        { status: 400 }
      );
    }

    // Verify ownership
    const utenteAzienda = await prisma.utenteAzienda.findUnique({
      where: { utenteId_societaId: { utenteId: user.id, societaId } },
    });

    if (!utenteAzienda) {
      return NextResponse.json(
        { error: "Accesso all'azienda non trovato" },
        { status: 404 }
      );
    }

    const existing = await prisma.notaAzienda.findFirst({
      where: { id: notaId, utenteAziendaId: utenteAzienda.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Nota non trovata" },
        { status: 404 }
      );
    }

    await prisma.notaAzienda.delete({
      where: { id: notaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione della nota:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
