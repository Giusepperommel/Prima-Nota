import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MESI_LABEL = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    const anno = annoParam ? parseInt(annoParam, 10) : new Date().getFullYear();

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: {
        ragioneSociale: true,
        partitaIva: true,
        codiceFiscale: true,
      },
    });

    if (!societa) {
      return NextResponse.json({ error: "Societa non trovata" }, { status: 404 });
    }

    const dataInizio = new Date(`${anno}-01-01`);
    const dataFine = new Date(`${anno}-12-31`);

    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        bozza: false,
        dataOperazione: { gte: dataInizio, lte: dataFine },
      },
      select: {
        tipoOperazione: true,
        importoIva: true,
        ivaDetraibile: true,
        ivaIndetraibile: true,
        dataOperazione: true,
      },
    });

    // Aggregate totals
    let ivaDebito = 0;
    let ivaCredito = 0;
    let ivaIndetraibile = 0;

    // Monthly buckets (0-11)
    const mensileDebito = new Array(12).fill(0);
    const mensileCredito = new Array(12).fill(0);

    for (const op of operazioni) {
      const mese = new Date(op.dataOperazione).getMonth();

      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        const importoIva = Number(op.importoIva) || 0;
        ivaDebito += importoIva;
        mensileDebito[mese] += importoIva;
      } else {
        // COSTO or CESPITE
        const detraibile = Number(op.ivaDetraibile) || 0;
        const indetraibile = Number(op.ivaIndetraibile) || 0;
        ivaCredito += detraibile;
        ivaIndetraibile += indetraibile;
        mensileCredito[mese] += detraibile;
      }
    }

    // Round
    ivaDebito = Math.round(ivaDebito * 100) / 100;
    ivaCredito = Math.round(ivaCredito * 100) / 100;
    ivaIndetraibile = Math.round(ivaIndetraibile * 100) / 100;
    const saldoIva = Math.round((ivaDebito - ivaCredito) * 100) / 100;

    const andamentoMensile = Array.from({ length: 12 }, (_, i) => {
      const d = Math.round(mensileDebito[i] * 100) / 100;
      const c = Math.round(mensileCredito[i] * 100) / 100;
      return {
        mese: `${anno}-${String(i + 1).padStart(2, "0")}`,
        meseLabel: MESI_LABEL[i],
        ivaDebito: d,
        ivaCredito: c,
        saldoIva: Math.round((d - c) * 100) / 100,
      };
    });

    return NextResponse.json({
      anno,
      societa: {
        ragioneSociale: societa.ragioneSociale,
        partitaIva: societa.partitaIva,
        codiceFiscale: societa.codiceFiscale,
      },
      totali: { ivaDebito, ivaCredito, ivaIndetraibile, saldoIva },
      andamentoMensile,
    });
  } catch (error) {
    console.error("Errore nel riepilogo IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
