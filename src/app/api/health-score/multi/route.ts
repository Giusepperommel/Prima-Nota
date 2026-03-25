import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateHealthScore } from "@/lib/controlli/health-score";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;

    // Get all companies the user has access to
    const utenteAziende = await prisma.utenteAzienda.findMany({
      where: { utenteId: userId, attivo: true },
      include: {
        societa: {
          select: { id: true, ragioneSociale: true },
        },
      },
    });

    const results = await Promise.all(
      utenteAziende.map(async (ua) => {
        const score = await calculateHealthScore(ua.societaId, anno, mese);
        return {
          societaId: ua.societaId,
          ragioneSociale: ua.societa.ragioneSociale,
          score: score.scoreComplessivo,
          areaContabilita: score.areaContabilita,
          areaIva: score.areaIva,
          areaScadenze: score.areaScadenze,
          areaDocumentale: score.areaDocumentale,
          areaBanca: score.areaBanca,
        };
      })
    );

    // Sort by worst score first
    results.sort((a, b) => a.score - b.score);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Errore calcolo health score multi:", error);
    return NextResponse.json(
      { error: "Errore durante il calcolo degli health score" },
      { status: 500 }
    );
  }
}
