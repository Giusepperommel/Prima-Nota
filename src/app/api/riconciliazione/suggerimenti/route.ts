import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generaSuggerimenti, MovimentoPerMatch, OperazionePerMatch } from "@/lib/riconciliazione/matcher";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    // Get non-reconciled movements
    const movimentiBancari = await prisma.movimentoBancario.findMany({
      where: { societaId, statoRiconciliazione: "NON_RICONCILIATO" },
      orderBy: { data: "desc" },
      take: 100,
    });

    if (movimentiBancari.length === 0) {
      return NextResponse.json({ suggerimenti: [] });
    }

    // Get date range
    const dates = movimentiBancari.map((m) => m.data);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    minDate.setDate(minDate.getDate() - 10);
    maxDate.setDate(maxDate.getDate() + 10);

    // Get operations in date range that don't have a reconciliation
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        dataOperazione: { gte: minDate, lte: maxDate },
        movimentiBancari: { none: {} },
      },
      select: {
        id: true,
        dataOperazione: true,
        importoTotale: true,
        tipoOperazione: true,
        descrizione: true,
        numeroDocumento: true,
      },
    });

    const movimenti: MovimentoPerMatch[] = movimentiBancari.map((m) => ({
      id: m.id,
      data: m.data,
      importo: Number(m.importo),
      segno: m.segno as "DARE" | "AVERE",
      descrizione: m.descrizione,
    }));

    const ops: OperazionePerMatch[] = operazioni.map((o) => ({
      id: o.id,
      dataOperazione: o.dataOperazione,
      importoTotale: Number(o.importoTotale),
      tipoOperazione: o.tipoOperazione,
      descrizione: o.descrizione,
      numeroDocumento: o.numeroDocumento,
    }));

    const suggerimenti = generaSuggerimenti(movimenti, ops);

    return NextResponse.json({ suggerimenti });
  } catch (error) {
    console.error("Errore nella generazione dei suggerimenti:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
