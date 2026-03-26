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

    const richieste = await prisma.richiestaDocumento.findMany({
      where: { societaId },
      include: {
        accessoCliente: {
          select: { nome: true, email: true },
        },
        domande: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(richieste);
  } catch (error) {
    console.error("Errore lista richieste portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
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
    const body = await request.json();

    const { accessoClienteId, tipo, titolo, messaggio, scadenza, domande } = body;

    if (!accessoClienteId || !tipo || !titolo || !messaggio) {
      return NextResponse.json(
        { error: "accessoClienteId, tipo, titolo e messaggio sono obbligatori" },
        { status: 400 }
      );
    }

    // Verify the client belongs to this societa
    const accesso = await prisma.accessoCliente.findFirst({
      where: { id: Number(accessoClienteId), societaId },
    });

    if (!accesso) {
      return NextResponse.json(
        { error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    const richiesta = await prisma.richiestaDocumento.create({
      data: {
        societaId,
        accessoClienteId: Number(accessoClienteId),
        tipo,
        titolo,
        messaggio,
        scadenza: scadenza ? new Date(scadenza) : null,
        domande: domande?.length
          ? {
              create: domande.map((d: { testo: string; opzioni: unknown }) => ({
                testo: d.testo,
                opzioni: d.opzioni ?? [],
              })),
            }
          : undefined,
      },
      include: {
        domande: true,
      },
    });

    return NextResponse.json(richiesta, { status: 201 });
  } catch (error) {
    console.error("Errore creazione richiesta portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
