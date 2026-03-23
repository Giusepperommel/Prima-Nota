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
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    const { id } = await context.params;
    const utenteAziendaId = parseInt(id, 10);

    if (isNaN(utenteAziendaId)) {
      return NextResponse.json(
        { error: "ID non valido" },
        { status: 400 }
      );
    }

    const existing = await prisma.utenteAzienda.findFirst({
      where: { id: utenteAziendaId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Accesso non trovato" },
        { status: 404 }
      );
    }

    // Cannot change own role
    if (existing.utenteId === user.id) {
      return NextResponse.json(
        { error: "Non puoi modificare il tuo stesso accesso" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { ruolo, attivo } = body;

    const data: any = {};

    if (ruolo !== undefined) {
      const validRuoli = ["ADMIN", "STANDARD", "COMMERCIALISTA"];
      if (!validRuoli.includes(ruolo)) {
        return NextResponse.json(
          { error: "Ruolo non valido" },
          { status: 400 }
        );
      }
      data.ruolo = ruolo;
    }

    if (attivo !== undefined) {
      data.attivo = attivo;
    }

    const updated = await prisma.utenteAzienda.update({
      where: { id: utenteAziendaId },
      data,
      include: {
        utente: {
          select: { id: true, nome: true, cognome: true, email: true },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      utenteId: updated.utenteId,
      societaId: updated.societaId,
      ruolo: updated.ruolo,
      attivo: updated.attivo,
      ultimoAccesso: updated.ultimoAccesso?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      utente: updated.utente,
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento dell'accesso:", error);
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
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    const { id } = await context.params;
    const utenteAziendaId = parseInt(id, 10);

    if (isNaN(utenteAziendaId)) {
      return NextResponse.json(
        { error: "ID non valido" },
        { status: 400 }
      );
    }

    const existing = await prisma.utenteAzienda.findFirst({
      where: { id: utenteAziendaId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Accesso non trovato" },
        { status: 404 }
      );
    }

    // Cannot remove self
    if (existing.utenteId === user.id) {
      return NextResponse.json(
        { error: "Non puoi rimuovere il tuo stesso accesso" },
        { status: 400 }
      );
    }

    await prisma.utenteAzienda.delete({
      where: { id: utenteAziendaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione dell'accesso:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
