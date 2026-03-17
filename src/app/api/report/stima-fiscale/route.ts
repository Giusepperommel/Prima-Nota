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

    // RegimeFiscale enum only has ORDINARIO and FORFETTARIO
    // TRASPARENZA is handled as a tax calculation mode, not a DB regime
    const regimeFiscale = "ORDINARIO" as const;

    const aliquotaIrap = Number(societa.aliquotaIrap);

    // Fetch operations for the year
    const dataInizio = new Date(`${anno}-01-01`);
    const dataFine = new Date(`${anno}-12-31`);

    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        bozza: false,
        dataOperazione: {
          gte: dataInizio,
          lte: dataFine,
        },
      },
      select: {
        tipoOperazione: true,
        importoTotale: true,
        importoImponibile: true,
        aliquotaIva: true,
      },
    });

    // Fetch interest expenses from payment plans (by competence date)
    const pagamentiAnno = await prisma.pagamento.findMany({
      where: {
        data: { gte: dataInizio, lte: dataFine },
        quotaInteressi: { gt: 0 },
        stato: { not: "ANNULLATO" },
        pianoPagamento: {
          societaId,
          operazione: { eliminato: false, bozza: false },
        },
      },
      select: {
        quotaInteressi: true,
        pianoPagamento: {
          select: {
            operazione: {
              select: {
                tipoOperazione: true,
                cespite: {
                  select: {
                    veicolo: {
                      select: { percentualeDeducibilita: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let interessiPassivi = 0;
    let interessiDeducibili = 0;

    for (const pag of pagamentiAnno) {
      const qi = Number(pag.quotaInteressi);
      interessiPassivi += qi;

      // For vehicles: apply Art. 164 TUIR deductibility %
      const veicolo = pag.pianoPagamento.operazione.cespite?.veicolo;
      if (veicolo) {
        interessiDeducibili += qi * Number(veicolo.percentualeDeducibilita) / 100;
      } else {
        // Non-vehicle: 100% deductible
        interessiDeducibili += qi;
      }
    }

    interessiPassivi = Math.round(interessiPassivi * 100) / 100;
    interessiDeducibili = Math.round(interessiDeducibili * 100) / 100;

    // Fetch early closure penalties from payment plans
    const pianiChiusi = await prisma.pianoPagamento.findMany({
      where: {
        societaId,
        stato: "CHIUSO_ANTICIPATAMENTE",
        dataChiusura: { gte: dataInizio, lte: dataFine },
        penaleEstinzione: { gt: 0 },
        operazione: { eliminato: false, bozza: false },
      },
      select: { penaleEstinzione: true },
    });

    const penaliEstinzione = Math.round(
      pianiChiusi.reduce((sum, p) => sum + Number(p.penaleEstinzione), 0) * 100
    ) / 100;

    interessiDeducibili += penaliEstinzione;
    interessiDeducibili = Math.round(interessiDeducibili * 100) / 100;

    // Calculate fatturato and costi (using imponibile, with scorporo fallback for old records)
    let fatturato = 0;
    let costiDiretti = 0;

    for (const op of operazioni) {
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

    // Add depreciation
    const ammortamento = await getAmmortamentoTotaleSocieta(societaId, anno);
    const costi = Math.round((costiDiretti + ammortamento + interessiDeducibili) * 100) / 100;

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
      interessiPassivi: {
        totale: interessiPassivi,
        deducibili: interessiDeducibili,
        indeducibili: Math.round((interessiPassivi - interessiDeducibili) * 100) / 100,
        penaliEstinzione,
      },
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
