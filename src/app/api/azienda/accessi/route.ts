import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

    const accessi = await prisma.utenteAzienda.findMany({
      where: { societaId },
      include: {
        utente: {
          select: {
            id: true,
            nome: true,
            cognome: true,
            email: true,
            socio: {
              select: {
                id: true,
                nome: true,
                cognome: true,
                quotaPercentuale: true,
                attivo: true,
              },
            },
          },
        },
      },
      orderBy: [{ attivo: "desc" }, { createdAt: "asc" }],
    });

    const serialized = accessi.map((a) => ({
      id: a.id,
      utenteId: a.utenteId,
      societaId: a.societaId,
      ruolo: a.ruolo,
      attivo: a.attivo,
      ultimoAccesso: a.ultimoAccesso?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      utente: {
        id: a.utente.id,
        nome: a.utente.nome,
        cognome: a.utente.cognome,
        email: a.utente.email,
      },
      socio: a.utente.socio
        ? {
            id: a.utente.socio.id,
            nome: a.utente.socio.nome,
            cognome: a.utente.socio.cognome,
            quotaPercentuale: Number(a.utente.socio.quotaPercentuale),
            attivo: a.utente.socio.attivo,
          }
        : null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero degli accessi:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
