import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAmmortamentoTotaleSocieta,
  getAmmortamentoSocio,
} from "@/lib/ammortamento-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const socioId = user.socioId as number;

    const searchParams = request.nextUrl.searchParams;
    const da = searchParams.get("da");
    const a = searchParams.get("a");

    if (!da || !a) {
      return NextResponse.json(
        { error: "Parametri 'da' e 'a' obbligatori" },
        { status: 400 }
      );
    }

    const dateFilter = {
      dataOperazione: {
        gte: new Date(da),
        lte: new Date(a),
      },
    };

    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { capitaleSociale: true },
    });
    const capitaleSociale = societa?.capitaleSociale ? Number(societa.capitaleSociale) : null;

    const baseWhere = {
      societaId,
      eliminato: false,
      bozza: false,
      ...dateFilter,
    };

    // Rate in scadenza (current month)
    const now = new Date();
    const inizioMese = new Date(now.getFullYear(), now.getMonth(), 1);
    const fineMese = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const rateInScadenza = await prisma.pagamento.findMany({
      where: {
        stato: "PREVISTO",
        data: { gte: inizioMese, lte: fineMese },
        pianoPagamento: {
          societaId,
          stato: "ATTIVO",
          operazione: { eliminato: false, bozza: false },
        },
      },
      select: { importo: true },
    });

    const rateScadenzaCount = rateInScadenza.length;
    const rateScadenzaImporto = Math.round(
      rateInScadenza.reduce((sum, r) => sum + Number(r.importo), 0) * 100
    ) / 100;

    if (ruolo === "STANDARD") {
      // For STANDARD users: use their ripartizioni share
      const fatturatoRip = await prisma.ripartizioneOperazione.aggregate({
        _sum: { importoCalcolato: true },
        where: {
          socioId,
          operazione: {
            ...baseWhere,
            tipoOperazione: "FATTURA_ATTIVA",
          },
        },
      });

      const costiRip = await prisma.ripartizioneOperazione.aggregate({
        _sum: { importoCalcolato: true },
        where: {
          socioId,
          operazione: {
            ...baseWhere,
            tipoOperazione: "COSTO",
          },
        },
      });

      const numOperazioni = await prisma.operazione.count({
        where: {
          ...baseWhere,
          ripartizioni: {
            some: { socioId },
          },
        },
      });

      const fatturato = Number(fatturatoRip._sum.importoCalcolato ?? 0);
      const costiDiretti = Number(costiRip._sum.importoCalcolato ?? 0);

      // Add depreciation for socio
      const annoInizio = new Date(da).getFullYear();
      const annoFine = new Date(a).getFullYear();
      let ammortamento = 0;
      for (let anno = annoInizio; anno <= annoFine; anno++) {
        ammortamento += await getAmmortamentoSocio(societaId, socioId, anno);
      }
      ammortamento = Math.round(ammortamento * 100) / 100;
      const costi = Math.round((costiDiretti + ammortamento) * 100) / 100;

      return NextResponse.json({
        fatturato,
        costi,
        ammortamento,
        utile: Math.round((fatturato - costi) * 100) / 100,
        numOperazioni,
        capitaleSociale,
        rateInScadenza: {
          count: rateScadenzaCount,
          importo: rateScadenzaImporto,
        },
      });
    }

    // ADMIN: use importoImponibile (net) with fallback for old records
    const adminOperazioni = await prisma.operazione.findMany({
      where: baseWhere,
      select: {
        tipoOperazione: true,
        importoTotale: true,
        importoImponibile: true,
        aliquotaIva: true,
      },
    });

    const numOperazioni = adminOperazioni.length;

    let fatturato = 0;
    let costiDiretti = 0;
    for (const op of adminOperazioni) {
      // Use importoImponibile if available; otherwise compute from totale/aliquota; last resort: totale
      let importo: number;
      if (op.importoImponibile != null) {
        importo = Number(op.importoImponibile);
      } else if (op.aliquotaIva != null && Number(op.aliquotaIva) > 0) {
        importo = Number(op.importoTotale) / (1 + Number(op.aliquotaIva) / 100);
      } else {
        importo = Number(op.importoTotale);
      }
      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        fatturato += importo;
      } else if (op.tipoOperazione === "COSTO") {
        costiDiretti += importo;
      }
    }
    fatturato = Math.round(fatturato * 100) / 100;
    costiDiretti = Math.round(costiDiretti * 100) / 100;

    // Add depreciation for societa
    const annoInizio = new Date(da).getFullYear();
    const annoFine = new Date(a).getFullYear();
    let ammortamento = 0;
    for (let anno = annoInizio; anno <= annoFine; anno++) {
      ammortamento += await getAmmortamentoTotaleSocieta(societaId, anno);
    }
    ammortamento = Math.round(ammortamento * 100) / 100;
    const costi = Math.round((costiDiretti + ammortamento) * 100) / 100;

    return NextResponse.json({
      fatturato,
      costi,
      ammortamento,
      utile: Math.round((fatturato - costi) * 100) / 100,
      numOperazioni,
      capitaleSociale,
      rateInScadenza: {
        count: rateScadenzaCount,
        importo: rateScadenzaImporto,
      },
    });
  } catch (error) {
    console.error("Errore nel recupero KPI:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
