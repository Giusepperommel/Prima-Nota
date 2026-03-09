import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaRipartizione, calcolaPianoAmmortamento } from "@/lib/business-utils";
import { logAttivita } from "@/lib/log-helper";
import { Prisma } from "@prisma/client";

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
      categoriaId,
      importoDeducibile,
      percentualeDeducibilita,
      deducibilitaCustom,
      tipoRipartizione,
      socioSingoloId,
      ripartizioniCustom,
      note,
      aliquotaAmmortamento,
    } = body;

    // --- Validations ---

    // Required fields
    if (!tipoOperazione || !dataOperazione || !descrizione || !categoriaId) {
      return NextResponse.json(
        { error: "Tipo operazione, data, descrizione e categoria sono obbligatori" },
        { status: 400 }
      );
    }

    // Tipo operazione
    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "SPESA", "CESPITE"];
    if (!tipiValidi.includes(tipoOperazione)) {
      return NextResponse.json(
        { error: "Tipo operazione non valido" },
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

    // Validate categoriaId exists and belongs to the societa
    const categoria = await prisma.categoriaSpesa.findFirst({
      where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
    });
    if (!categoria) {
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
    const percDeduc = deducibilitaCustom
      ? parseFloat(String(percentualeDeducibilita))
      : Number(categoria.percentualeDeducibilita);

    const impDeduc = deducibilitaCustom
      ? parseFloat(String(importoDeducibile))
      : Math.round((importo * Number(categoria.percentualeDeducibilita)) / 100 * 100) / 100;

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
          categoriaId: parseInt(String(categoriaId), 10),
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

      // Create cespite + depreciation schedule if CESPITE
      if (tipoOperazione === "CESPITE") {
        const aliquota = parseFloat(String(aliquotaAmmortamento));
        const annoInizio = new Date(dataOperazione).getFullYear();
        const piano = calcolaPianoAmmortamento(importo, aliquota, annoInizio);
        const fondoFinale = piano.length > 0
          ? piano[piano.length - 1].fondoProgressivo
          : 0;
        const statoFinale = fondoFinale >= importo ? "COMPLETATO" : "IN_AMMORTAMENTO";

        const cespite = await tx.cespite.create({
          data: {
            operazioneId: op.id,
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
        categoriaId: parseInt(String(categoriaId), 10),
        tipoRipartizione,
      },
    });

    return NextResponse.json(
      {
        ...operazione,
        importoTotale: Number(operazione.importoTotale),
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
