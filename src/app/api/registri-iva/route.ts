import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const registroIva = searchParams.get("registroIva");
    const annoParam = searchParams.get("anno");
    const meseParam = searchParams.get("mese");

    if (!registroIva || !["VENDITE", "ACQUISTI", "CORRISPETTIVI"].includes(registroIva)) {
      return NextResponse.json(
        { error: "Parametro registroIva obbligatorio (VENDITE, ACQUISTI, CORRISPETTIVI)" },
        { status: 400 }
      );
    }

    if (!annoParam) {
      return NextResponse.json(
        { error: "Parametro anno obbligatorio" },
        { status: 400 }
      );
    }

    const anno = parseInt(annoParam, 10);
    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    let dataInizio: Date;
    let dataFine: Date;

    if (meseParam) {
      const mese = parseInt(meseParam, 10);
      if (isNaN(mese) || mese < 1 || mese > 12) {
        return NextResponse.json({ error: "Mese non valido (1-12)" }, { status: 400 });
      }
      dataInizio = new Date(anno, mese - 1, 1);
      dataFine = new Date(anno, mese, 0); // last day of month
    } else {
      dataInizio = new Date(anno, 0, 1);
      dataFine = new Date(anno, 11, 31);
    }

    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        registroIva: registroIva as any,
        dataRegistrazione: {
          gte: dataInizio,
          lte: dataFine,
        },
      },
      include: {
        fornitore: { select: { id: true, denominazione: true, partitaIva: true } },
        cliente: { select: { id: true, denominazione: true, partitaIva: true } },
      },
      orderBy: [{ dataRegistrazione: "asc" }, { protocolloIva: "asc" }],
    });

    const serialized = operazioni.map((op) => ({
      id: op.id,
      protocolloIva: op.protocolloIva,
      dataRegistrazione: op.dataRegistrazione?.toISOString() ?? null,
      fornitore: op.fornitore
        ? { id: op.fornitore.id, denominazione: op.fornitore.denominazione, partitaIva: op.fornitore.partitaIva }
        : null,
      cliente: op.cliente
        ? { id: op.cliente.id, denominazione: op.cliente.denominazione, partitaIva: op.cliente.partitaIva }
        : null,
      descrizione: op.descrizione,
      importoImponibile: op.importoImponibile != null ? Number(op.importoImponibile) : null,
      aliquotaIva: op.aliquotaIva != null ? Number(op.aliquotaIva) : null,
      importoIva: op.importoIva != null ? Number(op.importoIva) : null,
      naturaOperazioneIva: op.naturaOperazioneIva,
      tipoDocumentoSdi: op.tipoDocumentoSdi,
    }));

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error("Errore nel recupero registri IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
