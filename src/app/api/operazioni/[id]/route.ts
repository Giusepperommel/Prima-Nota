import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaRipartizione, calcolaPianoAmmortamento } from "@/lib/business-utils";
import { generaPianoPagamento } from "@/lib/calcoli-pagamenti";
import { logAttivita } from "@/lib/log-helper";
import { processIva } from "@/lib/iva/engine";
import { getNextProtocollo, formatProtocollo } from "@/lib/iva/doppia-registrazione";
import { generaScritturaPerOperazione } from "@/lib/contabilita/db-scrittura";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const userId = user.id as number;
    const socioId = user.socioId as number;
    const { id } = await context.params;
    const operazioneId = parseInt(id, 10);

    if (isNaN(operazioneId)) {
      return NextResponse.json(
        { error: "ID operazione non valido" },
        { status: 400 }
      );
    }

    const operazione = await prisma.operazione.findFirst({
      where: { id: operazioneId, societaId, eliminato: false },
      include: {
        categoria: {
          select: { id: true, nome: true, percentualeDeducibilita: true },
        },
        createdBy: {
          select: {
            id: true,
            socio: { select: { id: true, nome: true, cognome: true } },
          },
        },
        ripartizioni: {
          include: {
            socio: {
              select: {
                id: true,
                nome: true,
                cognome: true,
                quotaPercentuale: true,
              },
            },
          },
          orderBy: { socio: { cognome: "asc" } },
        },
        fornitore: true,
        cliente: true,
        codiceConto: true,
        ritenuta: true,
      },
    });

    if (!operazione) {
      return NextResponse.json(
        { error: "Operazione non trovata" },
        { status: 404 }
      );
    }

    // STANDARD users can only see their own operations or ones they have a ripartizione in
    if (ruolo === "STANDARD") {
      const isCreator = operazione.createdByUserId === userId;
      const hasRipartizione = operazione.ripartizioni.some(
        (rip) => rip.socioId === socioId
      );
      if (!isCreator && !hasRipartizione) {
        return NextResponse.json(
          { error: "Accesso negato" },
          { status: 403 }
        );
      }
    }

    // Serialize Decimal fields
    const serialized = {
      ...operazione,
      importoTotale: Number(operazione.importoTotale),
      aliquotaIva: operazione.aliquotaIva != null ? Number(operazione.aliquotaIva) : null,
      importoImponibile: operazione.importoImponibile != null ? Number(operazione.importoImponibile) : null,
      importoIva: operazione.importoIva != null ? Number(operazione.importoIva) : null,
      percentualeDetraibilitaIva: operazione.percentualeDetraibilitaIva != null ? Number(operazione.percentualeDetraibilitaIva) : null,
      ivaDetraibile: operazione.ivaDetraibile != null ? Number(operazione.ivaDetraibile) : null,
      ivaIndetraibile: operazione.ivaIndetraibile != null ? Number(operazione.ivaIndetraibile) : null,
      opzioneUso: operazione.opzioneUso,
      importoRitenuta: operazione.importoRitenuta ? Number(operazione.importoRitenuta) : null,
      importoNettoRitenuta: operazione.importoNettoRitenuta ? Number(operazione.importoNettoRitenuta) : null,
      importoPagato: operazione.importoPagato ? Number(operazione.importoPagato) : null,
      importoBollo: operazione.importoBollo ? Number(operazione.importoBollo) : null,
      importoDeducibile: Number(operazione.importoDeducibile),
      percentualeDeducibilita: Number(operazione.percentualeDeducibilita),
      dataOperazione: operazione.dataOperazione.toISOString(),
      createdAt: operazione.createdAt.toISOString(),
      updatedAt: operazione.updatedAt.toISOString(),
      categoria: operazione.categoria
        ? {
            ...operazione.categoria,
            percentualeDeducibilita: Number(
              operazione.categoria.percentualeDeducibilita
            ),
          }
        : null,
      ripartizioni: operazione.ripartizioni.map((rip) => ({
        ...rip,
        percentuale: Number(rip.percentuale),
        importoCalcolato: Number(rip.importoCalcolato),
        socio: {
          ...rip.socio,
          quotaPercentuale: Number(rip.socio.quotaPercentuale),
        },
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero dell'operazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const ruolo = user.ruolo as string;
    const { id } = await context.params;
    const operazioneId = parseInt(id, 10);

    if (isNaN(operazioneId)) {
      return NextResponse.json(
        { error: "ID operazione non valido" },
        { status: 400 }
      );
    }

    // Load existing operazione
    const existing = await prisma.operazione.findFirst({
      where: { id: operazioneId, societaId, eliminato: false },
      include: {
        ripartizioni: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Operazione non trovata" },
        { status: 404 }
      );
    }

    // Permission check: STANDARD can only modify their own
    if (ruolo === "STANDARD" && existing.createdByUserId !== userId) {
      return NextResponse.json(
        { error: "Non hai i permessi per modificare questa operazione" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      tipoOperazione,
      dataOperazione,
      numeroDocumento,
      descrizione,
      importoTotale,
      aliquotaIva,
      importoImponibile,
      importoIva,
      percentualeDetraibilitaIva,
      ivaDetraibile,
      ivaIndetraibile,
      opzioneUso,
      categoriaId,
      importoDeducibile,
      percentualeDeducibilita,
      deducibilitaCustom,
      tipoRipartizione,
      socioSingoloId,
      ripartizioniCustom,
      note,
      aliquotaAmmortamento,
      sottotipoOperazione,
      modalitaPagamento,
      pianoPagamentoData,
      pagamentiCustom,
      fornitoreId,
      clienteId,
      tipoMerce,
      sanMarinoConIva,
      isReverseChargeInterno,
    } = body;

    // --- Validations ---
    const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
    const isTipoFinanziario = TIPI_FINANZIARI.includes(tipoOperazione);

    if (!tipoOperazione || !dataOperazione || !descrizione || (!isTipoFinanziario && !categoriaId)) {
      return NextResponse.json(
        { error: "Tipo operazione, data, descrizione e categoria sono obbligatori" },
        { status: 400 }
      );
    }

    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE", "PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
    if (!tipiValidi.includes(tipoOperazione)) {
      return NextResponse.json(
        { error: "Tipo operazione non valido" },
        { status: 400 }
      );
    }

    // Validate sottotipoOperazione for new financial types
    const SOTTOTIPI_IMPOSTE = ["IVA", "IRES_ACCONTO", "IRES_SALDO", "IRAP_ACCONTO", "IRAP_SALDO", "INPS"];
    if (tipoOperazione === "PAGAMENTO_IMPOSTE") {
      if (!sottotipoOperazione || !SOTTOTIPI_IMPOSTE.includes(sottotipoOperazione)) {
        return NextResponse.json(
          { error: "Specificare il tipo di imposta (IVA, IRES_ACCONTO, ecc.)" },
          { status: 400 }
        );
      }
    } else if (isTipoFinanziario && sottotipoOperazione != null) {
      return NextResponse.json(
        { error: "sottotipoOperazione non applicabile per questo tipo" },
        { status: 400 }
      );
    }

    const isRicorrente = Boolean(body.isRicorrente);

    if (isTipoFinanziario && isRicorrente) {
      return NextResponse.json(
        { error: "I tipi finanziari non possono essere operazioni ricorrenti" },
        { status: 400 }
      );
    }

    const importo = parseFloat(importoTotale);
    if (isNaN(importo) || importo <= 0) {
      return NextResponse.json(
        { error: "L'importo totale deve essere maggiore di zero" },
        { status: 400 }
      );
    }

    const tipiRipartizioneValidi = ["COMUNE", "SINGOLO", "CUSTOM"];
    if (!tipoRipartizione || !tipiRipartizioneValidi.includes(tipoRipartizione)) {
      return NextResponse.json(
        { error: "Tipo ripartizione non valido" },
        { status: 400 }
      );
    }

    // Validate categoria (skip for new financial types)
    const categoria = !isTipoFinanziario
      ? await prisma.categoriaSpesa.findFirst({
          where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
        })
      : null;
    if (!isTipoFinanziario && !categoria) {
      return NextResponse.json(
        { error: "Categoria non trovata o non attiva" },
        { status: 400 }
      );
    }

    // Get active soci
    const soci = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { id: true, quotaPercentuale: true },
    });

    if (soci.length === 0) {
      return NextResponse.json(
        { error: "Non ci sono soci attivi per la ripartizione" },
        { status: 400 }
      );
    }

    const sociForCalc = soci.map((s) => ({
      id: s.id,
      quotaPercentuale: Number(s.quotaPercentuale),
    }));

    // Validate SINGOLO
    if (tipoRipartizione === "SINGOLO") {
      if (!socioSingoloId) {
        return NextResponse.json(
          { error: "Per la ripartizione Singolo, selezionare un socio" },
          { status: 400 }
        );
      }
      const socioExists = soci.find(
        (s) => s.id === parseInt(String(socioSingoloId), 10)
      );
      if (!socioExists) {
        return NextResponse.json(
          { error: "Socio selezionato non trovato tra i soci attivi" },
          { status: 400 }
        );
      }
    }

    // Validate CUSTOM
    if (tipoRipartizione === "CUSTOM") {
      if (
        !ripartizioniCustom ||
        !Array.isArray(ripartizioniCustom) ||
        ripartizioniCustom.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Per la ripartizione Custom, specificare le percentuali per ogni socio",
          },
          { status: 400 }
        );
      }
      const sommaPercentuali = ripartizioniCustom.reduce(
        (sum: number, r: { percentuale: number }) =>
          sum + (parseFloat(String(r.percentuale)) || 0),
        0
      );
      if (Math.abs(sommaPercentuali - 100) > 0.01) {
        return NextResponse.json(
          {
            error: `La somma delle percentuali custom deve essere 100% (attuale: ${sommaPercentuali.toFixed(2)}%)`,
          },
          { status: 400 }
        );
      }
    }

    // Validate CESPITE
    if (tipoOperazione === "CESPITE") {
      const aliquota = parseFloat(String(aliquotaAmmortamento));
      if (isNaN(aliquota) || aliquota <= 0 || aliquota > 100) {
        return NextResponse.json(
          { error: "L'aliquota di ammortamento deve essere tra 1% e 100%" },
          { status: 400 }
        );
      }
    }

    // Calculate ripartizioni
    const customPerc =
      tipoRipartizione === "CUSTOM"
        ? ripartizioniCustom.map(
            (r: { socioId: number; percentuale: number }) => ({
              socioId: parseInt(String(r.socioId), 10),
              percentuale: parseFloat(String(r.percentuale)),
            })
          )
        : undefined;

    // Use imponibile for ripartizioni (net of IVA); fallback to totale for old/forfettario
    const importoPerRipartizione = importoImponibile != null
      ? parseFloat(String(importoImponibile))
      : importo;

    const ripartizioniCalcolate = calcolaRipartizione(
      importoPerRipartizione,
      tipoRipartizione as "COMUNE" | "SINGOLO" | "CUSTOM",
      sociForCalc,
      socioSingoloId ? parseInt(String(socioSingoloId), 10) : undefined,
      customPerc
    );

    // Deducibilita values
    const percDeduc = isTipoFinanziario
      ? 0
      : deducibilitaCustom
        ? parseFloat(String(percentualeDeducibilita))
        : Number(categoria!.percentualeDeducibilita);

    const impDeduc = isTipoFinanziario
      ? 0
      : deducibilitaCustom
        ? parseFloat(String(importoDeducibile))
        : Math.round(
            ((importo * Number(categoria!.percentualeDeducibilita)) / 100) * 100
          ) / 100;

    // Snapshot before values
    const valoriPrima = {
      tipoOperazione: existing.tipoOperazione,
      dataOperazione: existing.dataOperazione.toISOString(),
      descrizione: existing.descrizione,
      importoTotale: Number(existing.importoTotale),
      categoriaId: existing.categoriaId,
      tipoRipartizione: existing.tipoRipartizione,
      importoDeducibile: Number(existing.importoDeducibile),
      percentualeDeducibilita: Number(existing.percentualeDeducibilita),
    };

    // Update operazione + ripartizioni in a transaction
    const operazione = await prisma.$transaction(async (tx) => {
      const op = await tx.operazione.update({
        where: { id: operazioneId },
        data: {
          tipoOperazione: tipoOperazione as any,
          dataOperazione: new Date(dataOperazione),
          dataRegistrazione: new Date(dataOperazione),
          numeroDocumento: numeroDocumento || null,
          descrizione,
          importoTotale: importo,
          aliquotaIva: isTipoFinanziario ? null : (aliquotaIva != null ? parseFloat(String(aliquotaIva)) : null),
          importoImponibile: isTipoFinanziario ? null : (importoImponibile != null ? parseFloat(String(importoImponibile)) : null),
          importoIva: isTipoFinanziario ? null : (importoIva != null ? parseFloat(String(importoIva)) : null),
          percentualeDetraibilitaIva: isTipoFinanziario ? null : (percentualeDetraibilitaIva != null ? parseFloat(String(percentualeDetraibilitaIva)) : null),
          ivaDetraibile: isTipoFinanziario ? null : (ivaDetraibile != null ? parseFloat(String(ivaDetraibile)) : null),
          ivaIndetraibile: isTipoFinanziario ? null : (ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : null),
          opzioneUso: opzioneUso || null,
          categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
          sottotipoOperazione: tipoOperazione === "PAGAMENTO_IMPOSTE" ? sottotipoOperazione : null,
          importoDeducibile: impDeduc,
          percentualeDeducibilita: percDeduc,
          deducibilitaCustom: Boolean(deducibilitaCustom),
          tipoRipartizione: tipoRipartizione as any,
          note: note || null,
          bozza: false,
          fornitoreId: fornitoreId ? parseInt(String(fornitoreId), 10) : null,
          clienteId: clienteId ? parseInt(String(clienteId), 10) : null,
          tipoMerce: tipoMerce || null,
        },
      });

      // Delete old ripartizioni and create new ones
      await tx.ripartizioneOperazione.deleteMany({
        where: { operazioneId },
      });

      await tx.ripartizioneOperazione.createMany({
        data: ripartizioniCalcolate.map((rip) => ({
          operazioneId: op.id,
          socioId: rip.socioId,
          percentuale: rip.percentuale,
          importoCalcolato: rip.importo,
        })),
      });

      // Handle cespite changes
      const wasCespite = existing.tipoOperazione === "CESPITE";
      const isCespite = tipoOperazione === "CESPITE";

      // Remove old cespite data if type changed or values updated
      if (wasCespite || isCespite) {
        await tx.cespite.deleteMany({ where: { operazioneId } });
      }

      // Create new cespite + depreciation schedule
      if (isCespite) {
        const aliquota = parseFloat(String(aliquotaAmmortamento));
        const annoInizio = new Date(dataOperazione).getFullYear();
        const piano = calcolaPianoAmmortamento(importo, aliquota, annoInizio);
        const fondoFinale = piano.length > 0
          ? piano[piano.length - 1].fondoProgressivo
          : 0;
        const statoFinale = fondoFinale >= importo ? "COMPLETATO" : "IN_AMMORTAMENTO";

        const cespite = await tx.cespite.create({
          data: {
            operazioneId,
            societaId,
            descrizione,
            valoreIniziale: importo,
            aliquotaAmmortamento: aliquota,
            dataAcquisto: new Date(dataOperazione),
            annoInizio,
            stato: statoFinale as any,
            fondoAmmortamento: fondoFinale,
          },
        });

        if (piano.length > 0) {
          await tx.quotaAmmortamento.createMany({
            data: piano.map((q) => ({
              cespiteId: cespite.id,
              anno: q.anno,
              aliquotaApplicata: q.aliquotaApplicata,
              importoQuota: q.importoQuota,
              fondoProgressivo: q.fondoProgressivo,
            })),
          });
        }
      }

      // Handle payment plan changes
      const existingPiano = await tx.pianoPagamento.findUnique({
        where: { operazioneId },
        include: { pagamenti: true },
      });

      const wantsPiano = modalitaPagamento && modalitaPagamento !== "IMMEDIATO";

      if (existingPiano && !wantsPiano) {
        // User switched to IMMEDIATO — delete the payment plan
        await tx.pagamento.deleteMany({ where: { pianoPagamentoId: existingPiano.id } });
        await tx.pianoPagamento.delete({ where: { id: existingPiano.id } });
      } else if (wantsPiano) {
        // Delete existing plan if present, then recreate
        if (existingPiano) {
          await tx.pagamento.deleteMany({ where: { pianoPagamentoId: existingPiano.id } });
          await tx.pianoPagamento.delete({ where: { id: existingPiano.id } });
        }

        const ppTipo = modalitaPagamento as "RATEALE" | "CUSTOM";

        if (ppTipo === "RATEALE" && pianoPagamentoData) {
          const anticipoVal = pianoPagamentoData.anticipo ? parseFloat(String(pianoPagamentoData.anticipo)) : 0;
          const importoDaFinanziare = importo - anticipoVal;
          const tanVal = pianoPagamentoData.tan != null ? parseFloat(String(pianoPagamentoData.tan)) : 0;
          const nRate = parseInt(String(pianoPagamentoData.numeroRate));
          const dataInizioRata = new Date(pianoPagamentoData.dataInizio);

          const pianoCalcolato = generaPianoPagamento(importoDaFinanziare, nRate, tanVal, dataInizioRata);

          const pp = await tx.pianoPagamento.create({
            data: {
              operazioneId,
              societaId,
              tipo: "RATEALE",
              stato: "ATTIVO",
              numeroRate: nRate,
              importoRata: pianoCalcolato.rate.length > 0 ? pianoCalcolato.rate[0].importo : 0,
              tan: tanVal,
              anticipo: anticipoVal,
              dataInizio: dataInizioRata,
            },
          });

          const pagamentiData: any[] = [];
          let numPag = 0;

          if (anticipoVal > 0) {
            numPag++;
            pagamentiData.push({
              pianoPagamentoId: pp.id,
              numeroPagamento: numPag,
              data: dataInizioRata,
              importo: anticipoVal,
              quotaCapitale: anticipoVal,
              quotaInteressi: 0,
              stato: "EFFETTUATO",
              dataEffettivaPagamento: dataInizioRata,
            });
          }

          for (const rata of pianoCalcolato.rate) {
            numPag++;
            pagamentiData.push({
              pianoPagamentoId: pp.id,
              numeroPagamento: numPag,
              data: rata.data,
              importo: rata.importo,
              quotaCapitale: rata.quotaCapitale,
              quotaInteressi: rata.quotaInteressi,
              stato: "PREVISTO",
            });
          }

          await tx.pagamento.createMany({ data: pagamentiData });
        } else if (ppTipo === "CUSTOM" && pagamentiCustom) {
          const pp = await tx.pianoPagamento.create({
            data: {
              operazioneId,
              societaId,
              tipo: "CUSTOM",
              stato: "ATTIVO",
              dataInizio: new Date(pagamentiCustom[0]?.data || new Date()),
            },
          });

          if (pagamentiCustom.length > 0) {
            await tx.pagamento.createMany({
              data: pagamentiCustom.map((p: any, i: number) => ({
                pianoPagamentoId: pp.id,
                numeroPagamento: i + 1,
                data: new Date(p.data),
                importo: parseFloat(String(p.importo)),
                quotaCapitale: parseFloat(String(p.importo)),
                quotaInteressi: 0,
                stato: "PREVISTO",
                note: p.note || null,
              })),
            });
          }
        }
      }

      // --- IVA Engine: delete old autofatture and re-create if needed ---
      // Soft-delete any existing autofatture linked to this operation
      await tx.operazione.updateMany({
        where: { operazioneOrigineId: operazioneId, eliminato: false },
        data: { eliminato: true },
      });

      if (tipoMerce) {
        // Fetch anagrafica nazione if fornitore or cliente is set
        let nazioneFornitore: string | null = null;
        const anagraficaId = fornitoreId || clienteId;
        if (anagraficaId) {
          const anagrafica = await tx.anagrafica.findUnique({
            where: { id: parseInt(String(anagraficaId), 10) },
            select: { nazione: true },
          });
          nazioneFornitore = anagrafica?.nazione ?? null;
        }

        const shouldProcess = nazioneFornitore !== "IT" || isReverseChargeInterno;

        if (shouldProcess) {
          const ivaResult = processIva({
            nazioneFornitore,
            tipoMerce,
            tipoOperazione: tipoOperazione as "COSTO" | "FATTURA_ATTIVA",
            descrizione,
            importoImponibile: importoImponibile != null ? parseFloat(String(importoImponibile)) : importo,
            aliquotaIva: aliquotaIva != null ? parseFloat(String(aliquotaIva)) : null,
            isReverseChargeInterno: Boolean(isReverseChargeInterno),
            sanMarinoConIva: Boolean(sanMarinoConIva),
          });

          // Create autofattura if required
          if (ivaResult.classification.richiedeAutofattura && ivaResult.autofattura) {
            const af = ivaResult.autofattura;
            const year = new Date(dataOperazione).getFullYear();

            // Get last protocollo for ACQUISTI register
            const lastAcquisti = await tx.operazione.findFirst({
              where: {
                societaId,
                registroIva: "ACQUISTI",
                protocolloIva: { not: null },
                dataOperazione: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31`),
                },
              },
              orderBy: { protocolloIva: "desc" },
              select: { protocolloIva: true },
            });

            // Get last protocollo for VENDITE register (needed for doppia registrazione)
            const lastVendite = await tx.operazione.findFirst({
              where: {
                societaId,
                OR: [
                  { registroIva: "VENDITE" },
                  { protocolloIvaVendite: { not: null } },
                ],
                dataOperazione: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31`),
                },
              },
              orderBy: { protocolloIvaVendite: "desc" },
              select: { protocolloIvaVendite: true },
            });

            const protocolloAcquisti = formatProtocollo(
              getNextProtocollo(lastAcquisti?.protocolloIva),
              year
            );
            const protocolloVendite = af.doppiaRegistrazione
              ? formatProtocollo(
                  getNextProtocollo(lastVendite?.protocolloIvaVendite),
                  year
                )
              : null;

            await tx.operazione.create({
              data: {
                societaId,
                tipoOperazione: tipoOperazione as any,
                dataOperazione: new Date(dataOperazione),
                dataRegistrazione: new Date(),
                descrizione: af.descrizione,
                importoTotale: af.importoImponibile + af.importoIva,
                importoImponibile: af.importoImponibile,
                aliquotaIva: af.aliquotaIva,
                importoIva: af.importoIva,
                tipoDocumentoSdi: af.tipoDocumentoSdi,
                tipoMerce: af.tipoMerce,
                doppiaRegistrazione: af.doppiaRegistrazione,
                registroIva: af.registroIva,
                naturaOperazioneIva: af.naturaOperazioneIva,
                protocolloIva: protocolloAcquisti,
                protocolloIvaVendite: protocolloVendite,
                operazioneOrigineId: op.id,
                fornitoreId: fornitoreId ? parseInt(String(fornitoreId), 10) : null,
                clienteId: clienteId ? parseInt(String(clienteId), 10) : null,
                importoDeducibile: 0,
                percentualeDeducibilita: 0,
                deducibilitaCustom: false,
                tipoRipartizione: tipoRipartizione as any,
                createdByUserId: userId,
              },
            });
          }

          // Create splafonamento autofattura (TD21) if present
          if (ivaResult.splafonamentoAutofattura) {
            const sf = ivaResult.splafonamentoAutofattura;
            const year = new Date(dataOperazione).getFullYear();

            const lastAcquistiSplaf = await tx.operazione.findFirst({
              where: {
                societaId,
                registroIva: "ACQUISTI",
                protocolloIva: { not: null },
                dataOperazione: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31`),
                },
              },
              orderBy: { protocolloIva: "desc" },
              select: { protocolloIva: true },
            });

            const protocolloSplaf = formatProtocollo(
              getNextProtocollo(lastAcquistiSplaf?.protocolloIva),
              year
            );

            await tx.operazione.create({
              data: {
                societaId,
                tipoOperazione: tipoOperazione as any,
                dataOperazione: new Date(dataOperazione),
                dataRegistrazione: new Date(),
                descrizione: sf.descrizione,
                importoTotale: sf.importoImponibile + sf.importoIva,
                importoImponibile: sf.importoImponibile,
                aliquotaIva: sf.aliquotaIva,
                importoIva: sf.importoIva,
                tipoDocumentoSdi: sf.tipoDocumentoSdi,
                tipoMerce: sf.tipoMerce,
                doppiaRegistrazione: sf.doppiaRegistrazione,
                registroIva: sf.registroIva,
                naturaOperazioneIva: sf.naturaOperazioneIva,
                protocolloIva: protocolloSplaf,
                operazioneOrigineId: op.id,
                fornitoreId: fornitoreId ? parseInt(String(fornitoreId), 10) : null,
                clienteId: clienteId ? parseInt(String(clienteId), 10) : null,
                importoDeducibile: 0,
                percentualeDeducibilita: 0,
                deducibilitaCustom: false,
                tipoRipartizione: tipoRipartizione as any,
                createdByUserId: userId,
              },
            });
          }
        }
      }

      // --- Regenerate scrittura contabile ---
      try {
        // Delete old scritture (cascades to movimenti via onDelete: Cascade)
        await tx.scritturaContabile.deleteMany({
          where: { operazioneId: operazioneId },
        });

        // Regenerate scrittura with updated data
        await generaScritturaPerOperazione({
          tx,
          operazioneId,
          societaId,
          operazione: {
            tipoOperazione,
            dataOperazione: new Date(dataOperazione),
            descrizione,
            importoTotale: importo,
            importoImponibile: importoImponibile ? parseFloat(String(importoImponibile)) : undefined,
            importoIva: importoIva ? parseFloat(String(importoIva)) : undefined,
            aliquotaIva: aliquotaIva ? parseFloat(String(aliquotaIva)) : undefined,
            ivaDetraibile: ivaDetraibile ? parseFloat(String(ivaDetraibile)) : undefined,
            ivaIndetraibile: ivaIndetraibile ? parseFloat(String(ivaIndetraibile)) : undefined,
            numeroDocumento: numeroDocumento || undefined,
          },
          categoriaContoId: categoria?.contoDefaultId ?? null,
          anagraficaDenominazione: undefined,
          userId,
          isCespite: tipoOperazione === "CESPITE",
          isReverseCharge: Boolean(isReverseChargeInterno),
          isNotaCredito: false,
          isSplitPayment: false,
        });
      } catch (scritturaError) {
        // Non-blocking: log the error but don't fail the operation
        console.error(
          "[Scritture] Errore rigenerazione scrittura contabile su PUT:",
          scritturaError
        );
      }

      return op;
    });

    // Log the update
    const valoriDopo = {
      tipoOperazione,
      dataOperazione,
      descrizione,
      importoTotale: importo,
      categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
      tipoRipartizione,
      importoDeducibile: impDeduc,
      percentualeDeducibilita: percDeduc,
    };

    await logAttivita({
      userId,
      azione: "UPDATE",
      tabella: "operazioni",
      recordId: operazioneId,
      valoriPrima,
      valoriDopo,
    });

    return NextResponse.json({
      ...operazione,
      importoTotale: Number(operazione.importoTotale),
      aliquotaIva: operazione.aliquotaIva != null ? Number(operazione.aliquotaIva) : null,
      importoImponibile: operazione.importoImponibile != null ? Number(operazione.importoImponibile) : null,
      importoIva: operazione.importoIva != null ? Number(operazione.importoIva) : null,
      percentualeDetraibilitaIva: operazione.percentualeDetraibilitaIva != null ? Number(operazione.percentualeDetraibilitaIva) : null,
      ivaDetraibile: operazione.ivaDetraibile != null ? Number(operazione.ivaDetraibile) : null,
      ivaIndetraibile: operazione.ivaIndetraibile != null ? Number(operazione.ivaIndetraibile) : null,
      opzioneUso: operazione.opzioneUso,
      importoDeducibile: Number(operazione.importoDeducibile),
      percentualeDeducibilita: Number(operazione.percentualeDeducibilita),
      dataOperazione: operazione.dataOperazione.toISOString(),
      createdAt: operazione.createdAt.toISOString(),
      updatedAt: operazione.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento dell'operazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const ruolo = user.ruolo as string;
    const { id } = await context.params;
    const operazioneId = parseInt(id, 10);

    if (isNaN(operazioneId)) {
      return NextResponse.json(
        { error: "ID operazione non valido" },
        { status: 400 }
      );
    }

    const existing = await prisma.operazione.findFirst({
      where: { id: operazioneId, societaId, eliminato: false },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Operazione non trovata" },
        { status: 404 }
      );
    }

    // Permission check: STANDARD can only delete their own
    if (ruolo === "STANDARD" && existing.createdByUserId !== userId) {
      return NextResponse.json(
        { error: "Non hai i permessi per eliminare questa operazione" },
        { status: 403 }
      );
    }

    // Check for linked autofatture and cascade soft-delete them
    const autofatture = await prisma.operazione.findMany({
      where: { operazioneOrigineId: operazioneId, eliminato: false },
    });

    // Soft delete the operation and its linked autofatture in a transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete the main operation
      await tx.operazione.update({
        where: { id: operazioneId },
        data: { eliminato: true },
      });

      // Soft delete linked autofatture (protocolli IVA remain as gaps / "annullato")
      if (autofatture.length > 0) {
        await tx.operazione.updateMany({
          where: { operazioneOrigineId: operazioneId, eliminato: false },
          data: { eliminato: true },
        });
      }

      // Soft-delete linked scritture contabili
      await tx.scritturaContabile.updateMany({
        where: { operazioneId: operazioneId, eliminato: false },
        data: { eliminato: true },
      });
    });

    // Log the deletion
    await logAttivita({
      userId,
      azione: "DELETE",
      tabella: "operazioni",
      recordId: operazioneId,
      valoriPrima: {
        tipoOperazione: existing.tipoOperazione,
        dataOperazione: existing.dataOperazione.toISOString(),
        descrizione: existing.descrizione,
        importoTotale: Number(existing.importoTotale),
        categoriaId: existing.categoriaId,
        tipoRipartizione: existing.tipoRipartizione,
      },
    });

    return NextResponse.json({
      success: true,
      autofattureEliminate: autofatture.length,
    });
  } catch (error) {
    console.error("Errore nell'eliminazione dell'operazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
