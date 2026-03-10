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

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const data = await prisma.operazioneRicorrente.findMany({
      where: { societaId },
      include: {
        categoria: { select: { id: true, nome: true } },
        createdBy: {
          select: {
            id: true,
            socio: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
      orderBy: [{ attiva: "desc" }, { descrizione: "asc" }],
    });

    const serialized = data.map(serializeOperazioneRicorrente);

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error("Errore nel recupero delle operazioni ricorrenti:", error);
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

    const body = await request.json();

    const {
      tipoOperazione,
      categoriaId,
      descrizione,
      importoTotale,
      aliquotaIva,
      importoImponibile,
      importoIva,
      percentualeDetraibilitaIva,
      ivaDetraibile,
      ivaIndetraibile,
      opzioneUso,
      percentualeDeducibilita,
      importoDeducibile,
      deducibilitaCustom,
      tipoRipartizione,
      socioSingoloId,
      note,
      giornoDelMese,
      dataInizio,
      dataFine,
      tipoContratto,
      valoreBene,
      maxicanone,
      durataContratto,
      quotaServizi,
      rateRimanenti,
    } = body;

    // --- Validations ---
    if (!tipoOperazione || !descrizione || !categoriaId) {
      return NextResponse.json(
        { error: "Tipo operazione, descrizione e categoria sono obbligatori" },
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

    const giorno = parseInt(String(giornoDelMese), 10);
    if (isNaN(giorno) || giorno < 1 || giorno > 31) {
      return NextResponse.json(
        { error: "Il giorno del mese deve essere tra 1 e 31" },
        { status: 400 }
      );
    }

    if (!dataInizio) {
      return NextResponse.json(
        { error: "La data di inizio è obbligatoria" },
        { status: 400 }
      );
    }

    if (!tipoRipartizione) {
      return NextResponse.json(
        { error: "Il tipo di ripartizione è obbligatorio" },
        { status: 400 }
      );
    }

    // Calculate prossimaGenerazione
    const dataInizioDate = new Date(dataInizio);
    const prossimaGenerazione = calcolaProssimaGenerazione(giorno, dataInizioDate);

    const operazione = await prisma.operazioneRicorrente.create({
      data: {
        societaId,
        createdByUserId: userId,
        tipoOperazione: tipoOperazione as any,
        categoriaId: parseInt(String(categoriaId), 10),
        descrizione,
        importoTotale: importo,
        aliquotaIva: aliquotaIva != null ? parseFloat(String(aliquotaIva)) : null,
        importoImponibile: importoImponibile != null ? parseFloat(String(importoImponibile)) : null,
        importoIva: importoIva != null ? parseFloat(String(importoIva)) : null,
        percentualeDetraibilitaIva: percentualeDetraibilitaIva != null ? parseFloat(String(percentualeDetraibilitaIva)) : null,
        ivaDetraibile: ivaDetraibile != null ? parseFloat(String(ivaDetraibile)) : null,
        ivaIndetraibile: ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : null,
        opzioneUso: opzioneUso || null,
        percentualeDeducibilita: parseFloat(String(percentualeDeducibilita)) || 0,
        importoDeducibile: parseFloat(String(importoDeducibile)) || 0,
        deducibilitaCustom: Boolean(deducibilitaCustom),
        tipoRipartizione: tipoRipartizione as any,
        socioSingoloId: socioSingoloId ? parseInt(String(socioSingoloId), 10) : null,
        note: note || null,
        giornoDelMese: giorno,
        dataInizio: dataInizioDate,
        dataFine: dataFine ? new Date(dataFine) : null,
        prossimaGenerazione,
        tipoContratto: tipoContratto || null,
        valoreBene: valoreBene != null ? parseFloat(String(valoreBene)) : null,
        maxicanone: maxicanone != null ? parseFloat(String(maxicanone)) : null,
        durataContratto: durataContratto != null ? parseInt(String(durataContratto), 10) : null,
        quotaServizi: quotaServizi != null ? parseFloat(String(quotaServizi)) : null,
        rateRimanenti: rateRimanenti != null ? parseInt(String(rateRimanenti), 10) : null,
      },
    });

    await logAttivita({
      userId,
      azione: "INSERT",
      tabella: "operazioni_ricorrenti",
      recordId: operazione.id,
      valoriDopo: {
        tipoOperazione,
        descrizione,
        importoTotale: importo,
        categoriaId: parseInt(String(categoriaId), 10),
        giornoDelMese: giorno,
        tipoRipartizione,
      },
    });

    return NextResponse.json(serializeOperazioneRicorrente(operazione), { status: 201 });
  } catch (error) {
    console.error("Errore nella creazione dell'operazione ricorrente:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
