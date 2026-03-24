import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaAcconto } from "@/lib/liquidazione/acconto";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { anno, metodo, importoPrevisionale } = body;

    if (!anno) {
      return NextResponse.json(
        { error: "Parametro anno obbligatorio" },
        { status: 400 }
      );
    }

    if (metodo && ![1, 2, 3].includes(metodo)) {
      return NextResponse.json(
        { error: "Metodo non valido (1=storico, 2=previsionale, 3=analitico)" },
        { status: 400 }
      );
    }

    if (metodo === 2 && (importoPrevisionale == null || importoPrevisionale < 0)) {
      return NextResponse.json(
        { error: "Importo previsionale obbligatorio per metodo previsionale" },
        { status: 400 }
      );
    }

    const result = await calcolaAcconto({
      societaId,
      anno,
      metodo: metodo ?? 1,
      importoPrevisionale,
    });

    // If acconto is dovuto, update the Dec/Q4 liquidation record
    if (result.dovuto) {
      // Determine tipo from existing liquidations
      const existingLiq = await prisma.liquidazioneIva.findFirst({
        where: { societaId, anno },
        select: { tipo: true },
      });

      const tipo = existingLiq?.tipo ?? "MENSILE";
      const periodo = tipo === "MENSILE" ? 12 : 4;

      await prisma.liquidazioneIva.upsert({
        where: {
          societaId_tipo_periodo_anno: {
            societaId,
            tipo,
            periodo,
            anno,
          },
        },
        create: {
          societaId,
          tipo,
          periodo,
          anno,
          ivaEsigibile: 0,
          ivaDetraibile: 0,
          saldo: 0,
          accontoVersato: result.importo,
          metodoAcconto: result.metodo,
        },
        update: {
          accontoVersato: result.importo,
          metodoAcconto: result.metodo,
        },
      });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Errore nel calcolo acconto IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
