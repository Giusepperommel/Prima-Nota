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

    // For VENDITE register, also include doppia registrazione entries (reverse charge / autofattura)
    const registroFilter = registroIva === "VENDITE"
      ? { OR: [{ registroIva: "VENDITE" as any }, { doppiaRegistrazione: true }] }
      : { registroIva: registroIva as any };

    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        ...registroFilter,
        dataRegistrazione: {
          gte: dataInizio,
          lte: dataFine,
        },
      },
      include: {
        fornitore: { select: { id: true, denominazione: true, partitaIva: true, nazione: true } },
        cliente: { select: { id: true, denominazione: true, partitaIva: true, nazione: true } },
      },
      orderBy: [{ dataRegistrazione: "asc" }, { protocolloIva: "asc" }],
    });

    const serialized = operazioni.map((op) => ({
      id: op.id,
      // For doppia registrazione entries in VENDITE, use protocolloIvaVendite
      protocolloIva: (op.doppiaRegistrazione && registroIva === "VENDITE" && op.protocolloIvaVendite)
        ? op.protocolloIvaVendite
        : op.protocolloIva,
      dataRegistrazione: op.dataRegistrazione?.toISOString() ?? null,
      fornitore: op.fornitore
        ? { id: op.fornitore.id, denominazione: op.fornitore.denominazione, partitaIva: op.fornitore.partitaIva, nazione: op.fornitore.nazione }
        : null,
      cliente: op.cliente
        ? { id: op.cliente.id, denominazione: op.cliente.denominazione, partitaIva: op.cliente.partitaIva, nazione: op.cliente.nazione }
        : null,
      descrizione: op.descrizione,
      importoImponibile: op.importoImponibile != null ? Number(op.importoImponibile) : null,
      aliquotaIva: op.aliquotaIva != null ? Number(op.aliquotaIva) : null,
      importoIva: op.importoIva != null ? Number(op.importoIva) : null,
      naturaOperazioneIva: op.naturaOperazioneIva,
      tipoDocumentoSdi: op.tipoDocumentoSdi,
      doppiaRegistrazione: op.doppiaRegistrazione,
    }));

    // Compute totali per aliquota
    const totaliMap = new Map<
      string,
      { aliquota: number | null; natura: string | null; totaleImponibile: number; totaleIva: number; count: number }
    >();

    for (const op of operazioni) {
      const aliquota = op.aliquotaIva != null ? Number(op.aliquotaIva) : null;
      const natura = op.naturaOperazioneIva ?? null;
      const key = aliquota != null ? `aliq:${aliquota}` : `nat:${natura ?? "other"}`;

      const existing = totaliMap.get(key);
      const imponibile = Number(op.importoImponibile ?? 0);
      const iva = Number(op.importoIva ?? 0);

      if (existing) {
        existing.totaleImponibile += imponibile;
        existing.totaleIva += iva;
        existing.count += 1;
      } else {
        totaliMap.set(key, {
          aliquota,
          natura,
          totaleImponibile: imponibile,
          totaleIva: iva,
          count: 1,
        });
      }
    }

    const totaliPerAliquota = Array.from(totaliMap.values()).map((t) => ({
      ...t,
      totaleImponibile: Math.round(t.totaleImponibile * 100) / 100,
      totaleIva: Math.round(t.totaleIva * 100) / 100,
    }));

    // Sort: aliquota entries first (descending), then natura entries
    totaliPerAliquota.sort((a, b) => {
      if (a.aliquota != null && b.aliquota != null) return b.aliquota - a.aliquota;
      if (a.aliquota != null) return -1;
      if (b.aliquota != null) return 1;
      return (a.natura ?? "").localeCompare(b.natura ?? "");
    });

    const totaleGenerale = {
      imponibile: Math.round(totaliPerAliquota.reduce((s, t) => s + t.totaleImponibile, 0) * 100) / 100,
      iva: Math.round(totaliPerAliquota.reduce((s, t) => s + t.totaleIva, 0) * 100) / 100,
      count: totaliPerAliquota.reduce((s, t) => s + t.count, 0),
    };

    return NextResponse.json({ data: serialized, totaliPerAliquota, totaleGenerale });
  } catch (error) {
    console.error("Errore nel recupero registri IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
