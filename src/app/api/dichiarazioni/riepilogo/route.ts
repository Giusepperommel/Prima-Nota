import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getScadenziarioAnnuale } from "@/lib/dichiarazioni/f24";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = parseInt(searchParams.get("anno") ?? new Date().getFullYear().toString(), 10);

    // 1. Scadenziario
    const scadenze = getScadenziarioAnnuale(anno);
    const oggi = new Date();
    const prossimoMese = new Date(oggi);
    prossimoMese.setMonth(prossimoMese.getMonth() + 2);

    const prossimeScadenze = scadenze
      .filter((s) => s.data >= oggi && s.data <= prossimoMese)
      .map((s) => ({
        ...s,
        data: s.data.toISOString(),
        giorniMancanti: Math.ceil((s.data.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)),
      }));

    // 2. F24 summary
    const f24Stats = await prisma.f24Versamento.groupBy({
      by: ["stato"],
      where: { societaId: user.societaId, anno },
      _count: true,
      _sum: { totaleVersamento: true },
    });

    const f24Riepilogo = {
      daPagare: 0,
      pagati: 0,
      scaduti: 0,
      totaleDaPagare: 0,
      totalePagato: 0,
    };
    for (const s of f24Stats) {
      if (s.stato === "DA_PAGARE") {
        f24Riepilogo.daPagare = s._count;
        f24Riepilogo.totaleDaPagare = Number(s._sum.totaleVersamento ?? 0);
      } else if (s.stato === "PAGATO") {
        f24Riepilogo.pagati = s._count;
        f24Riepilogo.totalePagato = Number(s._sum.totaleVersamento ?? 0);
      } else if (s.stato === "SCADUTO") {
        f24Riepilogo.scaduti = s._count;
      }
    }

    // 3. CU summary
    const cuStats = await prisma.certificazioneUnica.groupBy({
      by: ["stato"],
      where: { societaId: user.societaId, anno },
      _count: true,
    });

    const cuRiepilogo = { bozza: 0, generate: 0, inviate: 0 };
    for (const s of cuStats) {
      if (s.stato === "BOZZA") cuRiepilogo.bozza = s._count;
      else if (s.stato === "GENERATA") cuRiepilogo.generate = s._count;
      else if (s.stato === "INVIATA") cuRiepilogo.inviate = s._count;
    }

    // 4. Ritenute summary
    const ritenuteStats = await prisma.ritenuta.groupBy({
      by: ["statoVersamento"],
      where: { societaId: user.societaId, annoCompetenza: anno },
      _count: true,
      _sum: { importoRitenuta: true },
    });

    const ritenuteRiepilogo = {
      daVersare: 0,
      versate: 0,
      scadute: 0,
      totaleRitenute: 0,
    };
    for (const s of ritenuteStats) {
      const importo = Number(s._sum.importoRitenuta ?? 0);
      ritenuteRiepilogo.totaleRitenute += importo;
      if (s.statoVersamento === "DA_VERSARE") ritenuteRiepilogo.daVersare = s._count;
      else if (s.statoVersamento === "VERSATO") ritenuteRiepilogo.versate = s._count;
      else if (s.statoVersamento === "SCADUTO") ritenuteRiepilogo.scadute = s._count;
    }

    // 5. Dichiarazioni fiscali status
    const dichiarazioni = await prisma.dichiarazioneFiscale.findMany({
      where: { societaId: user.societaId, anno },
    });

    const dichiarazioniRiepilogo = dichiarazioni.map((d) => ({
      tipo: d.tipo,
      stato: d.stato,
      dataGenerazione: d.dataGenerazione,
      dataInvio: d.dataInvio,
    }));

    return NextResponse.json({
      anno,
      prossimeScadenze,
      f24: f24Riepilogo,
      cu: cuRiepilogo,
      ritenute: ritenuteRiepilogo,
      dichiarazioni: dichiarazioniRiepilogo,
    });
  } catch (error) {
    console.error("Errore nel riepilogo dichiarazioni:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
