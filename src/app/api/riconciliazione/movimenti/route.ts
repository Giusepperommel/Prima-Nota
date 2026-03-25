import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const stato = searchParams.get("stato");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

    const where: any = { societaId };
    if (stato) {
      where.statoRiconciliazione = stato;
    }

    const [movimenti, total] = await Promise.all([
      prisma.movimentoBancario.findMany({
        where,
        include: {
          operazione: {
            select: {
              id: true,
              descrizione: true,
              importoTotale: true,
              dataOperazione: true,
              tipoOperazione: true,
            },
          },
        },
        orderBy: { data: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.movimentoBancario.count({ where }),
    ]);

    const serialized = movimenti.map((m) => ({
      id: m.id,
      data: m.data.toISOString(),
      descrizione: m.descrizione,
      importo: Number(m.importo),
      segno: m.segno,
      saldo: m.saldo ? Number(m.saldo) : null,
      riferimentoEsterno: m.riferimentoEsterno,
      statoRiconciliazione: m.statoRiconciliazione,
      operazione: m.operazione
        ? {
            id: m.operazione.id,
            descrizione: m.operazione.descrizione,
            importoTotale: Number(m.operazione.importoTotale),
            dataOperazione: m.operazione.dataOperazione.toISOString(),
          }
        : null,
    }));

    return NextResponse.json({ movimenti: serialized, total, page, limit });
  } catch (error) {
    console.error("Errore nel recupero movimenti bancari:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
