import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const societaId = user.societaId;

  if (!societaId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;
  const operazioneId = parseInt(id);
  if (isNaN(operazioneId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  const scrittura = await prisma.scritturaContabile.findFirst({
    where: {
      operazioneId,
      societaId,
      eliminato: false,
    },
    include: {
      movimenti: {
        include: {
          conto: {
            select: { codice: true, descrizione: true },
          },
        },
        orderBy: { ordine: "asc" },
      },
    },
  });

  if (!scrittura) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    id: scrittura.id,
    dataRegistrazione: scrittura.dataRegistrazione,
    dataCompetenza: scrittura.dataCompetenza,
    numeroProtocollo: scrittura.numeroProtocollo,
    anno: scrittura.anno,
    descrizione: scrittura.descrizione,
    causale: scrittura.causale,
    tipoScrittura: scrittura.tipoScrittura,
    stato: scrittura.stato,
    totaleDare: Number(scrittura.totaleDare),
    totaleAvere: Number(scrittura.totaleAvere),
    movimenti: scrittura.movimenti.map((m) => ({
      id: m.id,
      contoId: m.contoId,
      codiceConto: m.conto.codice,
      descrizioneConto: m.conto.descrizione,
      importoDare: Number(m.importoDare),
      importoAvere: Number(m.importoAvere),
      descrizione: m.descrizione,
    })),
  });
}
