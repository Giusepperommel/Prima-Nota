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
    const tipo = searchParams.get("tipo"); // CLIENTE or FORNITORE
    const anagraficaId = searchParams.get("anagraficaId");

    const where: any = { societaId };
    if (tipo) where.tipo = tipo;
    if (anagraficaId) where.anagraficaId = parseInt(anagraficaId, 10);

    const scadenze = await prisma.scadenzaPartitario.findMany({
      where,
      include: {
        anagrafica: {
          select: { id: true, denominazione: true, tipo: true, partitaIva: true },
        },
        operazione: {
          select: { id: true, descrizione: true, importoTotale: true, dataOperazione: true },
        },
      },
      orderBy: { dataScadenza: "asc" },
    });

    // Group by anagrafica
    const perAnagrafica = new Map<number, {
      anagrafica: any;
      saldoAperto: number;
      scadenze: any[];
    }>();

    for (const s of scadenze) {
      const key = s.anagraficaId;
      if (!perAnagrafica.has(key)) {
        perAnagrafica.set(key, {
          anagrafica: s.anagrafica,
          saldoAperto: 0,
          scadenze: [],
        });
      }
      const group = perAnagrafica.get(key)!;
      const residuo = Number(s.importo) - Number(s.importoPagato);
      if (s.stato !== "CHIUSA" && residuo > 0) {
        group.saldoAperto = Math.round((group.saldoAperto + residuo) * 100) / 100;
      }
      group.scadenze.push({
        id: s.id,
        dataScadenza: s.dataScadenza.toISOString(),
        importo: Number(s.importo),
        importoPagato: Number(s.importoPagato),
        stato: s.stato,
        tipo: s.tipo,
        operazione: s.operazione ? {
          id: s.operazione.id,
          descrizione: s.operazione.descrizione,
          importoTotale: Number(s.operazione.importoTotale),
          dataOperazione: s.operazione.dataOperazione.toISOString(),
        } : null,
      });
    }

    const result = Array.from(perAnagrafica.values()).sort(
      (a, b) => b.saldoAperto - a.saldoAperto,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore nel recupero del partitario:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
