import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUtenteAzienda(utenteId: number, societaId: number) {
  return prisma.utenteAzienda.findUnique({
    where: { utenteId_societaId: { utenteId, societaId } },
  });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const utenteAzienda = await getUtenteAzienda(user.id, societaId);
    if (!utenteAzienda) {
      return NextResponse.json(
        { error: "Accesso all'azienda non trovato" },
        { status: 404 }
      );
    }

    const note = await prisma.notaAzienda.findMany({
      where: { utenteAziendaId: utenteAzienda.id },
      orderBy: { updatedAt: "desc" },
    });

    const serialized = note.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero delle note:", error);
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

    const utenteAzienda = await getUtenteAzienda(user.id, societaId);
    if (!utenteAzienda) {
      return NextResponse.json(
        { error: "Accesso all'azienda non trovato" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { testo, colore } = body;

    if (!testo || !testo.trim()) {
      return NextResponse.json(
        { error: "Il testo della nota e' obbligatorio" },
        { status: 400 }
      );
    }

    const nota = await prisma.notaAzienda.create({
      data: {
        utenteAziendaId: utenteAzienda.id,
        testo,
        colore: colore || null,
      },
    });

    return NextResponse.json(
      {
        ...nota,
        createdAt: nota.createdAt.toISOString(),
        updatedAt: nota.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione della nota:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
