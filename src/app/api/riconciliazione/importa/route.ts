import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCSV, PRESET_MAPPINGS, ColumnMapping } from "@/lib/riconciliazione/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { csvContent, preset, mapping: customMapping, separatore } = body;

    if (!csvContent) {
      return NextResponse.json({ error: "Contenuto CSV obbligatorio" }, { status: 400 });
    }

    const mapping: ColumnMapping = customMapping || PRESET_MAPPINGS[preset || "GENERICO"];
    if (!mapping) {
      return NextResponse.json({ error: "Mapping non valido" }, { status: 400 });
    }

    const result = parseCSV(csvContent, mapping, separatore || ";");

    if (result.movimenti.length === 0) {
      return NextResponse.json({
        importati: 0,
        errori: result.errori,
      });
    }

    // Save movements to DB
    const created = await prisma.movimentoBancario.createMany({
      data: result.movimenti.map((m) => ({
        societaId,
        data: m.data,
        descrizione: m.descrizione,
        importo: m.importo,
        segno: m.segno,
        saldo: m.saldo,
        riferimentoEsterno: m.riferimentoEsterno,
        statoRiconciliazione: "NON_RICONCILIATO",
      })),
    });

    return NextResponse.json({
      importati: created.count,
      errori: result.errori,
    });
  } catch (error) {
    console.error("Errore nell'importazione CSV:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
