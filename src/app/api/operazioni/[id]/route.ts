import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaRipartizione, calcolaPianoAmmortamento } from "@/lib/business-utils";
import { logAttivita } from "@/lib/log-helper";

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
      where: { id: operazioneId, societaId, eliminato: false, bozza: false },
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
      importoDeducibile: Number(operazione.importoDeducibile),
      percentualeDeducibilita: Number(operazione.percentualeDeducibilita),
      dataOperazione: operazione.dataOperazione.toISOString(),
      createdAt: operazione.createdAt.toISOString(),
      updatedAt: operazione.updatedAt.toISOString(),
      categoria: {
        ...operazione.categoria,
        percentualeDeducibilita: Number(
          operazione.categoria.percentualeDeducibilita
        ),
      },
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
      where: { id: operazioneId, societaId, eliminato: false, bozza: false },
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
    } = body;

    // --- Validations ---
    if (!tipoOperazione || !dataOperazione || !descrizione || !categoriaId) {
      return NextResponse.json(
        { error: "Tipo operazione, data, descrizione e categoria sono obbligatori" },
        { status: 400 }
      );
    }

    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE"];
    if (!tipiValidi.includes(tipoOperazione)) {
      return NextResponse.json(
        { error: "Tipo operazione non valido" },
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

    // Validate categoria
    const categoria = await prisma.categoriaSpesa.findFirst({
      where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
    });
    if (!categoria) {
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
      : Math.round(
          ((importo * Number(categoria.percentualeDeducibilita)) / 100) * 100
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
          numeroDocumento: numeroDocumento || null,
          descrizione,
          importoTotale: importo,
          aliquotaIva: aliquotaIva != null ? parseFloat(String(aliquotaIva)) : null,
          importoImponibile: importoImponibile != null ? parseFloat(String(importoImponibile)) : null,
          importoIva: importoIva != null ? parseFloat(String(importoIva)) : null,
          percentualeDetraibilitaIva: percentualeDetraibilitaIva != null ? parseFloat(String(percentualeDetraibilitaIva)) : null,
          ivaDetraibile: ivaDetraibile != null ? parseFloat(String(ivaDetraibile)) : null,
          ivaIndetraibile: ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : null,
          opzioneUso: opzioneUso || null,
          categoriaId: parseInt(String(categoriaId), 10),
          importoDeducibile: impDeduc,
          percentualeDeducibilita: percDeduc,
          deducibilitaCustom: Boolean(deducibilitaCustom),
          tipoRipartizione: tipoRipartizione as any,
          note: note || null,
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

      return op;
    });

    // Log the update
    const valoriDopo = {
      tipoOperazione,
      dataOperazione,
      descrizione,
      importoTotale: importo,
      categoriaId: parseInt(String(categoriaId), 10),
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
      where: { id: operazioneId, societaId, eliminato: false, bozza: false },
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

    // Soft delete
    await prisma.operazione.update({
      where: { id: operazioneId },
      data: { eliminato: true },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione dell'operazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
