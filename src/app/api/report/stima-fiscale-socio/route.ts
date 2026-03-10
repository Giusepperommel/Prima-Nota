import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAmmortamentoSocio } from "@/lib/ammortamento-utils";
import { stimaFiscaleSocio } from "@/lib/tax-utils";

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
    const annoParam = searchParams.get("anno");
    const socioIdParam = searchParams.get("socioId");

    const anno = annoParam ? parseInt(annoParam, 10) : new Date().getFullYear();
    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    // Determine target socio
    let targetSocioId: number;
    if (ruolo === "ADMIN" && socioIdParam) {
      targetSocioId = parseInt(socioIdParam, 10);
    } else {
      targetSocioId = userSocioId;
    }

    // Fetch societa fiscal config
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: {
        ragioneSociale: true,
        regimeFiscale: true,
        aliquotaIrap: true,
      },
    });

    if (!societa) {
      return NextResponse.json({ error: "Societa non trovata" }, { status: 404 });
    }

    // Fetch socio info
    const socio = await prisma.socio.findFirst({
      where: { id: targetSocioId, societaId },
      select: {
        id: true,
        nome: true,
        cognome: true,
        quotaPercentuale: true,
        socioLavoratore: true,
      },
    });

    if (!socio) {
      return NextResponse.json({ error: "Socio non trovato" }, { status: 404 });
    }

    // RegimeFiscale enum only has ORDINARIO and FORFETTARIO
    // TRASPARENZA is handled as a tax calculation mode, not a DB regime
    const regimeFiscale = "ORDINARIO" as const;

    const aliquotaIrap = Number(societa.aliquotaIrap);

    // Fetch the socio's actual ripartizioni for the year
    const dataInizio = new Date(`${anno}-01-01`);
    const dataFine = new Date(`${anno}-12-31`);

    const ripartizioni = await prisma.ripartizioneOperazione.findMany({
      where: {
        socioId: targetSocioId,
        operazione: {
          societaId,
          eliminato: false,
          dataOperazione: { gte: dataInizio, lte: dataFine },
        },
      },
      include: {
        operazione: {
          select: { tipoOperazione: true, importoTotale: true },
        },
      },
    });

    // Calculate the socio's own fatturato and costi from ripartizioni
    let fatturato = 0;
    let costiDiretti = 0;

    for (const rip of ripartizioni) {
      const importoSocio = Number(rip.importoCalcolato);
      if (rip.operazione.tipoOperazione === "FATTURA_ATTIVA") {
        fatturato += importoSocio;
      } else if (rip.operazione.tipoOperazione === "COSTO") {
        costiDiretti += importoSocio;
      }
    }

    fatturato = Math.round(fatturato * 100) / 100;
    costiDiretti = Math.round(costiDiretti * 100) / 100;

    // Add socio's depreciation share
    const ammortamento = await getAmmortamentoSocio(societaId, targetSocioId, anno);
    const costi = Math.round((costiDiretti + ammortamento) * 100) / 100;

    // Calculate tax estimate for this socio
    const stima = stimaFiscaleSocio({
      fatturato,
      costi,
      ammortamento,
      regime: regimeFiscale,
      aliquotaIrap,
      socio: {
        nome: socio.nome,
        cognome: socio.cognome,
        quotaPercentuale: Number(socio.quotaPercentuale),
        socioLavoratore: socio.socioLavoratore,
      },
    });

    return NextResponse.json({
      societa: { ragioneSociale: societa.ragioneSociale },
      anno,
      ...stima,
    });
  } catch (error) {
    console.error("Errore nella generazione della stima fiscale socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
