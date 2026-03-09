import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAmmortamentoTotaleSocieta,
  getAmmortamentoPerSocio,
} from "@/lib/ammortamento-utils";
import { stimaFiscaleSocieta, type SocioInput } from "@/lib/tax-utils";

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
    const anno = annoParam ? parseInt(annoParam, 10) : new Date().getFullYear();

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json(
        { error: "Anno non valido" },
        { status: 400 },
      );
    }

    // Fetch societa with fiscal config
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: {
        ragioneSociale: true,
        partitaIva: true,
        codiceFiscale: true,
        regimeFiscale: true,
        aliquotaIrap: true,
      },
    });

    if (!societa) {
      return NextResponse.json(
        { error: "Societa non trovata" },
        { status: 404 },
      );
    }

    // Determine regime: default to ORDINARIO if not set
    const regimeFiscale = societa.regimeFiscale === "TRASPARENZA"
      ? "TRASPARENZA" as const
      : "ORDINARIO" as const;

    const aliquotaIrap = Number(societa.aliquotaIrap);

    // Fetch operations for the year
    const dataInizio = new Date(`${anno}-01-01`);
    const dataFine = new Date(`${anno}-12-31`);

    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        dataOperazione: {
          gte: dataInizio,
          lte: dataFine,
        },
      },
      select: {
        tipoOperazione: true,
        importoTotale: true,
      },
    });

    // Calculate fatturato and costi
    let fatturato = 0;
    let costiDiretti = 0;

    for (const op of operazioni) {
      const importo = Number(op.importoTotale);
      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        fatturato += importo;
      } else if (op.tipoOperazione === "COSTO" || op.tipoOperazione === "SPESA") {
        costiDiretti += importo;
      }
    }

    fatturato = Math.round(fatturato * 100) / 100;
    costiDiretti = Math.round(costiDiretti * 100) / 100;

    // Add depreciation
    const ammortamento = await getAmmortamentoTotaleSocieta(societaId, anno);
    const costi = Math.round((costiDiretti + ammortamento) * 100) / 100;

    // Fetch active soci
    const soci = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: {
        id: true,
        nome: true,
        cognome: true,
        quotaPercentuale: true,
        socioLavoratore: true,
      },
      orderBy: { cognome: "asc" },
    });

    const sociInput: SocioInput[] = soci.map((s) => ({
      socioId: s.id,
      nome: s.nome,
      cognome: s.cognome,
      quotaPercentuale: Number(s.quotaPercentuale),
      socioLavoratore: s.socioLavoratore,
    }));

    // Calculate tax estimate
    const stima = stimaFiscaleSocieta({
      fatturato,
      costi,
      regime: regimeFiscale,
      aliquotaIrap,
      soci: sociInput,
    });

    // For STANDARD users, filter to only show their own socio detail
    let dettaglioSoci = stima.dettaglioSoci;
    if (ruolo === "STANDARD") {
      dettaglioSoci = dettaglioSoci.filter((s) => s.socioId === userSocioId);
    }

    return NextResponse.json({
      societa: {
        ragioneSociale: societa.ragioneSociale,
        partitaIva: societa.partitaIva,
        codiceFiscale: societa.codiceFiscale,
      },
      anno,
      ...stima,
      dettaglioSoci,
    });
  } catch (error) {
    console.error("Errore nella generazione della stima fiscale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
