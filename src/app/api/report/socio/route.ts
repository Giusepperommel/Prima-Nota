import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAmmortamentoSocio } from "@/lib/ammortamento-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const userSocioId = user.socioId as number;

    const { searchParams } = new URL(request.url);
    const da = searchParams.get("da");
    const a = searchParams.get("a");
    const socioIdParam = searchParams.get("socioId");

    if (!da || !a) {
      return NextResponse.json(
        { error: "I parametri 'da' e 'a' sono obbligatori" },
        { status: 400 }
      );
    }

    const dataInizio = new Date(da);
    const dataFine = new Date(a);

    if (isNaN(dataInizio.getTime()) || isNaN(dataFine.getTime())) {
      return NextResponse.json(
        { error: "Date non valide" },
        { status: 400 }
      );
    }

    // Determine which socio to report on
    let targetSocioId: number;

    if (ruolo === "ADMIN" && socioIdParam) {
      targetSocioId = parseInt(socioIdParam, 10);
    } else {
      // Standard users always see their own report
      targetSocioId = userSocioId;
    }

    // Fetch socio info
    const socio = await prisma.socio.findFirst({
      where: { id: targetSocioId, societaId },
      select: {
        id: true,
        nome: true,
        cognome: true,
        quotaPercentuale: true,
      },
    });

    if (!socio) {
      return NextResponse.json(
        { error: "Socio non trovato" },
        { status: 404 }
      );
    }

    // Fetch societa info
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { ragioneSociale: true },
    });

    if (!societa) {
      return NextResponse.json(
        { error: "Societa non trovata" },
        { status: 404 }
      );
    }

    // Fetch all ripartizioni for the target socio within the date range
    const ripartizioni = await prisma.ripartizioneOperazione.findMany({
      where: {
        socioId: targetSocioId,
        operazione: {
          societaId,
          eliminato: false,
          dataOperazione: {
            gte: dataInizio,
            lte: dataFine,
          },
        },
      },
      include: {
        operazione: {
          include: {
            categoria: { select: { nome: true } },
          },
        },
      },
      orderBy: {
        operazione: {
          dataOperazione: "asc",
        },
      },
    });

    // Compute riepilogo
    let fatturato = 0;
    let costi = 0;

    const dettaglioOperazioni = ripartizioni.map((rip) => {
      const op = rip.operazione;
      const importoSocio = Number(rip.importoCalcolato);
      const importoTotale = Number(op.importoTotale);

      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        fatturato += importoSocio;
      } else if (
        op.tipoOperazione === "COSTO" ||
        op.tipoOperazione === "SPESA"
      ) {
        costi += importoSocio;
      }

      return {
        id: op.id,
        data: op.dataOperazione.toISOString(),
        tipo: op.tipoOperazione,
        descrizione: op.descrizione,
        importoTotale,
        importoSocio,
        percentuale: Number(rip.percentuale),
        categoria: op.categoria.nome,
      };
    });

    fatturato = Math.round(fatturato * 100) / 100;
    const costiDiretti = Math.round(costi * 100) / 100;

    // Add socio's depreciation share
    const annoInizio = dataInizio.getFullYear();
    const annoFine = dataFine.getFullYear();
    let ammortamento = 0;
    for (let anno = annoInizio; anno <= annoFine; anno++) {
      ammortamento += await getAmmortamentoSocio(societaId, targetSocioId, anno);
    }
    ammortamento = Math.round(ammortamento * 100) / 100;
    costi = Math.round((costiDiretti + ammortamento) * 100) / 100;
    const utile = Math.round((fatturato - costi) * 100) / 100;

    // Fetch cespiti detail for socio
    const cespitiSocio = await prisma.cespite.findMany({
      where: {
        societaId,
        operazione: {
          eliminato: false,
          ripartizioni: {
            some: { socioId: targetSocioId, percentuale: { gt: 0 } },
          },
        },
        quoteAmmortamento: {
          some: { anno: { gte: annoInizio, lte: annoFine } },
        },
      },
      include: {
        quoteAmmortamento: {
          where: { anno: { gte: annoInizio, lte: annoFine } },
        },
        operazione: {
          include: {
            ripartizioni: {
              where: { socioId: targetSocioId },
            },
          },
        },
      },
    });

    const dettaglioAmmortamento = cespitiSocio.map((c) => {
      const quotaTotale = c.quoteAmmortamento.reduce(
        (sum, q) => sum + Number(q.importoQuota), 0
      );
      const percentuale = Number(c.operazione.ripartizioni[0]?.percentuale ?? 0);
      const quotaSocio = Math.round(((quotaTotale * percentuale) / 100) * 100) / 100;
      return {
        cespiteId: c.id,
        descrizione: c.descrizione,
        valoreIniziale: Number(c.valoreIniziale),
        aliquota: Number(c.aliquotaAmmortamento),
        quotaAnnua: Math.round(quotaTotale * 100) / 100,
        percentualeSocio: percentuale,
        quotaSocio,
      };
    });

    return NextResponse.json({
      socio: {
        nome: socio.nome,
        cognome: socio.cognome,
        quotaPercentuale: Number(socio.quotaPercentuale),
      },
      societa: {
        ragioneSociale: societa.ragioneSociale,
      },
      periodo: { da, a },
      riepilogo: {
        fatturato,
        costi,
        ammortamento,
        utile,
      },
      dettaglioOperazioni,
      dettaglioAmmortamento,
    });
  } catch (error) {
    console.error("Errore nella generazione del report socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
