import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/alert
 * Lista alert per l'utente corrente.
 * Query params: stato, categoria
 * Restituisce alert con relazione regola + conteggi per stato.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const stato = searchParams.get("stato");
    const categoria = searchParams.get("categoria");

    const where: any = {
      utenteDestinatarioId: user.id,
      societaId,
    };
    if (stato) where.stato = stato;
    if (categoria) where.tipo = categoria;

    const alerts = await prisma.alertGenerato.findMany({
      where,
      orderBy: [{ gravita: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        regola: {
          select: { codice: true, descrizione: true, categoria: true },
        },
      },
    });

    const countByStato = await prisma.alertGenerato.groupBy({
      by: ["stato"],
      where: { utenteDestinatarioId: user.id, societaId },
      _count: true,
    });

    return NextResponse.json({ alerts, conteggi: countByStato });
  } catch (error) {
    console.error("Errore GET /api/alert:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
