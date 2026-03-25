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
    const giorniAvanti = parseInt(searchParams.get("giorni") || "90", 10);
    const tipo = searchParams.get("tipo"); // CLIENTE or FORNITORE

    const oggi = new Date();
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + giorniAvanti);

    const where: any = {
      societaId,
      stato: { not: "CHIUSA" },
      dataScadenza: { lte: dataLimite },
    };
    if (tipo) where.tipo = tipo;

    const scadenze = await prisma.scadenzaPartitario.findMany({
      where,
      include: {
        anagrafica: {
          select: { id: true, denominazione: true, tipo: true },
        },
        operazione: {
          select: { id: true, descrizione: true, importoTotale: true },
        },
      },
      orderBy: { dataScadenza: "asc" },
    });

    const serialized = scadenze.map((s) => {
      const dataScadenza = s.dataScadenza;
      const giorniAllaScadenza = Math.round(
        (dataScadenza.getTime() - oggi.getTime()) / 86400000,
      );

      return {
        id: s.id,
        dataScadenza: dataScadenza.toISOString(),
        importo: Number(s.importo),
        importoPagato: Number(s.importoPagato),
        residuo: Math.round((Number(s.importo) - Number(s.importoPagato)) * 100) / 100,
        stato: s.stato,
        tipo: s.tipo,
        giorniAllaScadenza,
        scaduta: giorniAllaScadenza < 0,
        anagrafica: s.anagrafica,
        operazione: s.operazione ? {
          id: s.operazione.id,
          descrizione: s.operazione.descrizione,
          importoTotale: Number(s.operazione.importoTotale),
        } : null,
      };
    });

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero dello scadenziario:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
