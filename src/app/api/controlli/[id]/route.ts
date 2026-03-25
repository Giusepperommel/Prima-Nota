import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AnomaliaStato } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const STATI_VALIDI: AnomaliaStato[] = ["RISOLTA", "IGNORATA", "FALSO_POSITIVO"];

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const { id } = await context.params;
    const anomaliaId = parseInt(id, 10);

    if (isNaN(anomaliaId)) {
      return NextResponse.json(
        { error: "ID anomalia non valido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const stato = body.stato as AnomaliaStato;

    if (!stato || !STATI_VALIDI.includes(stato)) {
      return NextResponse.json(
        { error: `Stato non valido. Valori ammessi: ${STATI_VALIDI.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify ownership
    const anomalia = await prisma.anomalia.findFirst({
      where: { id: anomaliaId, societaId },
    });

    if (!anomalia) {
      return NextResponse.json(
        { error: "Anomalia non trovata" },
        { status: 404 }
      );
    }

    const updated = await prisma.anomalia.update({
      where: { id: anomaliaId },
      data: {
        stato,
        risoltaDa: userId,
        risoltaAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Errore aggiornamento anomalia:", error);
    return NextResponse.json(
      { error: "Errore durante l'aggiornamento dell'anomalia" },
      { status: 500 }
    );
  }
}
