import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAttivita } from "@/lib/log-helper";
import { calcolaProssimaGenerazione } from "@/lib/calcoli-ricorrenze";

function serializeDecimal(value: unknown): number | null {
  return value != null ? Number(value) : null;
}

function serializeOperazioneRicorrente(op: any) {
  return {
    ...op,
    importoTotale: Number(op.importoTotale),
    aliquotaIva: serializeDecimal(op.aliquotaIva),
    importoImponibile: serializeDecimal(op.importoImponibile),
    importoIva: serializeDecimal(op.importoIva),
    percentualeDetraibilitaIva: serializeDecimal(op.percentualeDetraibilitaIva),
    ivaDetraibile: serializeDecimal(op.ivaDetraibile),
    ivaIndetraibile: serializeDecimal(op.ivaIndetraibile),
    percentualeDeducibilita: Number(op.percentualeDeducibilita),
    importoDeducibile: Number(op.importoDeducibile),
    valoreBene: serializeDecimal(op.valoreBene),
    maxicanone: serializeDecimal(op.maxicanone),
    quotaServizi: serializeDecimal(op.quotaServizi),
    dataInizio: op.dataInizio.toISOString(),
    dataFine: op.dataFine ? op.dataFine.toISOString() : null,
    prossimaGenerazione: op.prossimaGenerazione.toISOString(),
    createdAt: op.createdAt.toISOString(),
    updatedAt: op.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;

    const operazione = await prisma.operazioneRicorrente.findFirst({
      where: {
        id: parseInt(id, 10),
        societaId,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        createdBy: {
          select: {
            id: true,
            socio: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    if (!operazione) {
      return NextResponse.json(
        { error: "Operazione ricorrente non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeOperazioneRicorrente(operazione));
  } catch (error) {
    console.error("Errore nel recupero dell'operazione ricorrente:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const { id } = await params;
    const recordId = parseInt(id, 10);

    const existing = await prisma.operazioneRicorrente.findFirst({
      where: { id: recordId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Operazione ricorrente non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update data with only the fields present in the body
    const updateData: Record<string, unknown> = {};

    if (body.tipoOperazione !== undefined) updateData.tipoOperazione = body.tipoOperazione;
    if (body.categoriaId !== undefined) updateData.categoriaId = parseInt(String(body.categoriaId), 10);
    if (body.descrizione !== undefined) updateData.descrizione = body.descrizione;
    if (body.importoTotale !== undefined) updateData.importoTotale = parseFloat(String(body.importoTotale));
    if (body.aliquotaIva !== undefined) updateData.aliquotaIva = body.aliquotaIva != null ? parseFloat(String(body.aliquotaIva)) : null;
    if (body.importoImponibile !== undefined) updateData.importoImponibile = body.importoImponibile != null ? parseFloat(String(body.importoImponibile)) : null;
    if (body.importoIva !== undefined) updateData.importoIva = body.importoIva != null ? parseFloat(String(body.importoIva)) : null;
    if (body.percentualeDetraibilitaIva !== undefined) updateData.percentualeDetraibilitaIva = body.percentualeDetraibilitaIva != null ? parseFloat(String(body.percentualeDetraibilitaIva)) : null;
    if (body.ivaDetraibile !== undefined) updateData.ivaDetraibile = body.ivaDetraibile != null ? parseFloat(String(body.ivaDetraibile)) : null;
    if (body.ivaIndetraibile !== undefined) updateData.ivaIndetraibile = body.ivaIndetraibile != null ? parseFloat(String(body.ivaIndetraibile)) : null;
    if (body.opzioneUso !== undefined) updateData.opzioneUso = body.opzioneUso || null;
    if (body.percentualeDeducibilita !== undefined) updateData.percentualeDeducibilita = parseFloat(String(body.percentualeDeducibilita));
    if (body.importoDeducibile !== undefined) updateData.importoDeducibile = parseFloat(String(body.importoDeducibile));
    if (body.deducibilitaCustom !== undefined) updateData.deducibilitaCustom = Boolean(body.deducibilitaCustom);
    if (body.tipoRipartizione !== undefined) updateData.tipoRipartizione = body.tipoRipartizione;
    if (body.socioSingoloId !== undefined) updateData.socioSingoloId = body.socioSingoloId ? parseInt(String(body.socioSingoloId), 10) : null;
    if (body.note !== undefined) updateData.note = body.note || null;
    if (body.attiva !== undefined) updateData.attiva = Boolean(body.attiva);

    // Recurrence fields
    if (body.giornoDelMese !== undefined) updateData.giornoDelMese = parseInt(String(body.giornoDelMese), 10);
    if (body.dataInizio !== undefined) updateData.dataInizio = new Date(body.dataInizio);
    if (body.dataFine !== undefined) updateData.dataFine = body.dataFine ? new Date(body.dataFine) : null;

    // Recalculate prossimaGenerazione if giorno or dataInizio changed
    if (body.giornoDelMese !== undefined || body.dataInizio !== undefined) {
      const giorno = body.giornoDelMese !== undefined
        ? parseInt(String(body.giornoDelMese), 10)
        : existing.giornoDelMese;
      const dataInizioDate = body.dataInizio !== undefined
        ? new Date(body.dataInizio)
        : existing.dataInizio;
      updateData.prossimaGenerazione = calcolaProssimaGenerazione(giorno, dataInizioDate);
    }

    // Leasing/NLT fields
    if (body.tipoContratto !== undefined) updateData.tipoContratto = body.tipoContratto || null;
    if (body.valoreBene !== undefined) updateData.valoreBene = body.valoreBene != null ? parseFloat(String(body.valoreBene)) : null;
    if (body.maxicanone !== undefined) updateData.maxicanone = body.maxicanone != null ? parseFloat(String(body.maxicanone)) : null;
    if (body.durataContratto !== undefined) updateData.durataContratto = body.durataContratto != null ? parseInt(String(body.durataContratto), 10) : null;
    if (body.quotaServizi !== undefined) updateData.quotaServizi = body.quotaServizi != null ? parseFloat(String(body.quotaServizi)) : null;
    if (body.rateRimanenti !== undefined) updateData.rateRimanenti = body.rateRimanenti != null ? parseInt(String(body.rateRimanenti), 10) : null;

    const updated = await prisma.operazioneRicorrente.update({
      where: { id: recordId },
      data: updateData,
    });

    await logAttivita({
      userId,
      azione: "UPDATE",
      tabella: "operazioni_ricorrenti",
      recordId,
      valoriPrima: {
        descrizione: existing.descrizione,
        importoTotale: Number(existing.importoTotale),
        attiva: existing.attiva,
      },
      valoriDopo: updateData,
    });

    return NextResponse.json(serializeOperazioneRicorrente(updated));
  } catch (error) {
    console.error("Errore nell'aggiornamento dell'operazione ricorrente:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const { id } = await params;
    const recordId = parseInt(id, 10);

    const existing = await prisma.operazioneRicorrente.findFirst({
      where: { id: recordId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Operazione ricorrente non trovata" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Delete associated draft operations
      await tx.operazione.deleteMany({
        where: {
          operazioneRicorrenteId: recordId,
          bozza: true,
        },
      });

      // Unlink confirmed operations
      await tx.operazione.updateMany({
        where: {
          operazioneRicorrenteId: recordId,
        },
        data: {
          operazioneRicorrenteId: null,
        },
      });

      // Delete the recurring operation
      await tx.operazioneRicorrente.delete({
        where: { id: recordId },
      });
    });

    await logAttivita({
      userId,
      azione: "DELETE",
      tabella: "operazioni_ricorrenti",
      recordId,
      valoriPrima: {
        descrizione: existing.descrizione,
        importoTotale: Number(existing.importoTotale),
        attiva: existing.attiva,
        giornoDelMese: existing.giornoDelMese,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione dell'operazione ricorrente:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
