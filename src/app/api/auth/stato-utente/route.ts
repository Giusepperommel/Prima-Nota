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

    // Leggi lo stato aggiornato dal DB (il JWT potrebbe essere stale)
    const socio = await prisma.socio.findUnique({
      where: { id: user.socioId },
      select: {
        societaId: true,
        ruolo: true,
      },
    });

    if (!socio) {
      return NextResponse.json({ error: "Socio non trovato" }, { status: 404 });
    }

    return NextResponse.json({
      societaId: socio.societaId,
      ruolo: socio.ruolo,
    });
  } catch (error) {
    console.error("Errore nel controllo stato utente:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
