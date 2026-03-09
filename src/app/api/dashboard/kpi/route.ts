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
      ...dateFilter,
    };

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
            tipoOperazione: { in: ["COSTO", "SPESA"] },
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
      });
    }

    // ADMIN: aggregate on full importoTotale
    const fatturatoAgg = await prisma.operazione.aggregate({
      _sum: { importoTotale: true },
      where: {
        ...baseWhere,
        tipoOperazione: "FATTURA_ATTIVA",
      },
    });

    const costiAgg = await prisma.operazione.aggregate({
      _sum: { importoTotale: true },
      where: {
        ...baseWhere,
        tipoOperazione: { in: ["COSTO", "SPESA"] },
      },
    });

    const numOperazioni = await prisma.operazione.count({
      where: baseWhere,
    });

    const fatturato = Number(fatturatoAgg._sum.importoTotale ?? 0);
    const costiDiretti = Number(costiAgg._sum.importoTotale ?? 0);

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
    });
  } catch (error) {
    console.error("Errore nel recupero KPI:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
