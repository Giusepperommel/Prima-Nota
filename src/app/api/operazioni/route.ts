import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaRipartizione, calcolaPianoAmmortamento } from "@/lib/business-utils";
import { logAttivita } from "@/lib/log-helper";
import { Prisma } from "@prisma/client";
import {
  getLimiteFiscale,
  getPercentualiUso,
  calcolaBaseFiscale,
} from "@/lib/calcoli-veicoli";
import { generaPianoPagamento } from "@/lib/calcoli-pagamenti";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const da = searchParams.get("da");
    const a = searchParams.get("a");
    const tipo = searchParams.get("tipo");
    const categoriaId = searchParams.get("categoriaId");
    const socioIdFilter = searchParams.get("socioId");
    const tipoRipartizione = searchParams.get("tipoRipartizione");
    const q = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(1, Math.min(100, parseInt(searchParams.get("perPage") || "20", 10)));

    // Build the where clause
    const where: Prisma.OperazioneWhereInput = {
      societaId,
      eliminato: false,
      bozza: false,
    };

    // Date range filters
    if (da) {
      where.dataOperazione = {
        ...(where.dataOperazione as Prisma.DateTimeFilter || {}),
        gte: new Date(da),
      };
    }
    if (a) {
      where.dataOperazione = {
        ...(where.dataOperazione as Prisma.DateTimeFilter || {}),
        lte: new Date(a),
      };
    }

    // Tipo operazione filter
    if (tipo) {
      where.tipoOperazione = tipo as any;
    }

    // Categoria filter
    if (categoriaId) {
      where.categoriaId = parseInt(categoriaId, 10);
    }

    // Tipo ripartizione filter
    if (tipoRipartizione) {
      where.tipoRipartizione = tipoRipartizione as any;
    }

    // Text search in descrizione or numero_documento
    if (q) {
      where.OR = [
        { descrizione: { contains: q } },
        { numeroDocumento: { contains: q } },
      ];
    }

    // For STANDARD users: only show operations they created OR where they have a ripartizione
    if (ruolo === "STANDARD") {
      // If a socioId filter is applied by a standard user, only allow their own
      if (socioIdFilter && parseInt(socioIdFilter, 10) !== socioId) {
        return NextResponse.json({ data: [], total: 0, page, perPage });
      }

      where.OR = [
        ...(where.OR || []),
        { createdByUserId: userId },
        { ripartizioni: { some: { socioId } } },
      ];

      // If there was already a text search OR, combine them properly
      if (q) {
        const textConditions = [
          { descrizione: { contains: q } },
          { numeroDocumento: { contains: q } },
        ];
        const accessConditions = [
          { createdByUserId: userId },
          { ripartizioni: { some: { socioId } } },
        ];
        where.AND = [
          { OR: textConditions },
          { OR: accessConditions },
        ];
        delete where.OR;
      }
    }

    // For admin: allow socioId filter to filter by ripartizione socio
    if (ruolo === "ADMIN" && socioIdFilter) {
      where.ripartizioni = {
        some: { socioId: parseInt(socioIdFilter, 10) },
      };
    }

    // countOnly mode: return just counts without fetching full data
    if (searchParams.get("countOnly") === "true") {
      const [total, conDatiContabili] = await Promise.all([
        prisma.operazione.count({ where }),
        prisma.operazione.count({ where: { ...where, codiceContoId: { not: null } } }),
      ]);
      return NextResponse.json({ total, conDatiContabili });
    }

    const skip = (page - 1) * perPage;

    const [data, total] = await Promise.all([
      prisma.operazione.findMany({
        where,
        include: {
          categoria: { select: { id: true, nome: true } },
          createdBy: {
            select: {
              id: true,
              socio: { select: { id: true, nome: true, cognome: true } },
            },
          },
          ripartizioni: {
            include: {
              socio: { select: { id: true, nome: true, cognome: true, quotaPercentuale: true } },
            },
            orderBy: { socio: { cognome: "asc" } },
          },
          pianoPagamento: {
            select: {
              id: true,
              tipo: true,
              stato: true,
              pagamenti: {
                select: { importo: true, stato: true },
              },
            },
          },
          fornitore: { select: { id: true, denominazione: true } },
          cliente: { select: { id: true, denominazione: true } },
          codiceConto: { select: { id: true, codice: true, descrizione: true } },
        },
        orderBy: [{ dataOperazione: "desc" }, { createdAt: "desc" }],
        skip,
        take: perPage,
      }),
      prisma.operazione.count({ where }),
    ]);

    // Serialize Decimal fields to numbers
    const serialized = data.map((op) => ({
      ...op,
      importoTotale: Number(op.importoTotale),
      aliquotaIva: op.aliquotaIva != null ? Number(op.aliquotaIva) : null,
      importoImponibile: op.importoImponibile != null ? Number(op.importoImponibile) : null,
      importoIva: op.importoIva != null ? Number(op.importoIva) : null,
      percentualeDetraibilitaIva: op.percentualeDetraibilitaIva != null ? Number(op.percentualeDetraibilitaIva) : null,
      ivaDetraibile: op.ivaDetraibile != null ? Number(op.ivaDetraibile) : null,
      ivaIndetraibile: op.ivaIndetraibile != null ? Number(op.ivaIndetraibile) : null,
      opzioneUso: op.opzioneUso,
      importoRitenuta: op.importoRitenuta ? Number(op.importoRitenuta) : null,
      importoNettoRitenuta: op.importoNettoRitenuta ? Number(op.importoNettoRitenuta) : null,
      importoPagato: op.importoPagato ? Number(op.importoPagato) : null,
      importoBollo: op.importoBollo ? Number(op.importoBollo) : null,
      importoDeducibile: Number(op.importoDeducibile),
      percentualeDeducibilita: Number(op.percentualeDeducibilita),
      dataOperazione: op.dataOperazione.toISOString(),
      createdAt: op.createdAt.toISOString(),
      updatedAt: op.updatedAt.toISOString(),
      ripartizioni: op.ripartizioni.map((rip) => ({
        ...rip,
        percentuale: Number(rip.percentuale),
        importoCalcolato: Number(rip.importoCalcolato),
        socio: {
          ...rip.socio,
          quotaPercentuale: Number(rip.socio.quotaPercentuale),
        },
      })),
      pianoPagamento: op.pianoPagamento
        ? {
            id: op.pianoPagamento.id,
            tipo: op.pianoPagamento.tipo,
            stato: op.pianoPagamento.stato,
            importoTotale: Number(op.importoTotale),
            quotaPagata: Math.round(
              op.pianoPagamento.pagamenti
                .filter((p: any) => p.stato === "EFFETTUATO")
                .reduce((sum: number, p: any) => sum + Number(p.importo), 0) * 100
            ) / 100,
          }
        : null,
    }));

    return NextResponse.json({ data: serialized, total, page, perPage });
  } catch (error) {
    console.error("Errore nel recupero delle operazioni:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const ruolo = user.ruolo as string;

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
      sottotipoOperazione,
      aliquotaAmmortamento,
      modalitaPagamento,
      pianoPagamentoData,
      pagamentiCustom,
    } = body;

    const {
      isVeicolo,
      tipoVeicolo,
      usoVeicolo,
      modalitaAcquisto,
      marca,
      modelloVeicolo,
      targa,
    } = body;

    // --- Validations ---

    const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
    const isTipoFinanziario = TIPI_FINANZIARI.includes(tipoOperazione);

    // Required fields
    if (!tipoOperazione || !dataOperazione || !descrizione || (!isTipoFinanziario && !categoriaId)) {
      return NextResponse.json(
        { error: "Tipo operazione, data, descrizione e categoria sono obbligatori" },
        { status: 400 }
      );
    }

    // Tipo operazione
    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE", ...TIPI_FINANZIARI];
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

    // Importo
    const importo = parseFloat(importoTotale);
    if (isNaN(importo) || importo <= 0) {
      return NextResponse.json(
        { error: "L'importo totale deve essere maggiore di zero" },
        { status: 400 }
      );
    }

    // Tipo ripartizione
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

    // Get active soci for ripartizione
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
      const socioExists = soci.find((s) => s.id === parseInt(String(socioSingoloId), 10));
      if (!socioExists) {
        return NextResponse.json(
          { error: "Socio selezionato non trovato tra i soci attivi" },
          { status: 400 }
        );
      }
    }

    // Validate CUSTOM
    if (tipoRipartizione === "CUSTOM") {
      if (!ripartizioniCustom || !Array.isArray(ripartizioniCustom) || ripartizioniCustom.length === 0) {
        return NextResponse.json(
          { error: "Per la ripartizione Custom, specificare le percentuali per ogni socio" },
          { status: 400 }
        );
      }
      const sommaPercentuali = ripartizioniCustom.reduce(
        (sum: number, r: { percentuale: number }) => sum + (parseFloat(String(r.percentuale)) || 0),
        0
      );
      if (Math.abs(sommaPercentuali - 100) > 0.01) {
        return NextResponse.json(
          { error: `La somma delle percentuali custom deve essere 100% (attuale: ${sommaPercentuali.toFixed(2)}%)` },
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

    if (tipoOperazione === "CESPITE" && isVeicolo) {
      if (!tipoVeicolo || !usoVeicolo || !modalitaAcquisto) {
        return NextResponse.json(
          { error: "Tipo veicolo, uso e modalita acquisto sono obbligatori" },
          { status: 400 }
        );
      }
      if (!marca || !modelloVeicolo || !targa) {
        return NextResponse.json(
          { error: "Marca, modello e targa sono obbligatori" },
          { status: 400 }
        );
      }
    }

    // Calculate ripartizioni
    const customPerc = tipoRipartizione === "CUSTOM"
      ? ripartizioniCustom.map((r: { socioId: number; percentuale: number }) => ({
          socioId: parseInt(String(r.socioId), 10),
          percentuale: parseFloat(String(r.percentuale)),
        }))
      : undefined;

    const ripartizioniCalcolate = calcolaRipartizione(
      importo,
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

    // Create operazione + ripartizioni in a transaction
    const operazione = await prisma.$transaction(async (tx) => {
      const op = await tx.operazione.create({
        data: {
          societaId,
          tipoOperazione: tipoOperazione as any,
          dataOperazione: new Date(dataOperazione),
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
          createdByUserId: userId,
        },
      });

      // Create ripartizioni
      await tx.ripartizioneOperazione.createMany({
        data: ripartizioniCalcolate.map((rip) => ({
          operazioneId: op.id,
          socioId: rip.socioId,
          percentuale: rip.percentuale,
          importoCalcolato: rip.importo,
        })),
      });

      // Create cespite + depreciation schedule if CESPITE (with optional vehicle)
      if (tipoOperazione === "CESPITE") {
        const aliquota = parseFloat(String(aliquotaAmmortamento));
        const annoInizio = new Date(dataOperazione).getFullYear();

        let valorePerAmmortamento = importo;
        let veicoloData: any = null;

        if (isVeicolo) {
          const percUso = getPercentualiUso(usoVeicolo);
          const limiteFiscale = getLimiteFiscale(tipoVeicolo, usoVeicolo);
          const ivaIndet = ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : 0;
          valorePerAmmortamento = calcolaBaseFiscale(importo, ivaIndet, limiteFiscale);

          veicoloData = {
            tipoVeicolo,
            usoVeicolo,
            modalitaAcquisto,
            marca,
            modello: modelloVeicolo,
            targa,
            limiteFiscale: limiteFiscale === Infinity ? 999999.99 : limiteFiscale,
            percentualeDeducibilita: percUso.deducibilita,
            percentualeDetraibilitaIva: percUso.detraibilitaIva,
          };
        }

        const piano = calcolaPianoAmmortamento(valorePerAmmortamento, aliquota, annoInizio);
        const fondoFinale = piano.length > 0
          ? piano[piano.length - 1].fondoProgressivo
          : 0;
        const statoFinale = fondoFinale >= valorePerAmmortamento ? "COMPLETATO" : "IN_AMMORTAMENTO";

        const cespite = await tx.cespite.create({
          data: {
            operazioneId: op.id,
            societaId,
            descrizione,
            valoreIniziale: valorePerAmmortamento,
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

        if (isVeicolo && veicoloData) {
          const veicolo = await tx.veicolo.create({
            data: {
              cespiteId: cespite.id,
              ...veicoloData,
            },
          });

        }
      }

      // Create PianoPagamento if not immediate payment
      if (modalitaPagamento && modalitaPagamento !== "IMMEDIATO") {
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
              operazioneId: op.id,
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
              operazioneId: op.id,
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

      return op;
    });

    // Log the insert
    await logAttivita({
      userId,
      azione: "INSERT",
      tabella: "operazioni",
      recordId: operazione.id,
      valoriDopo: {
        tipoOperazione,
        dataOperazione,
        descrizione,
        importoTotale: importo,
        categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
        tipoRipartizione,
      },
    });

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione dell'operazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
