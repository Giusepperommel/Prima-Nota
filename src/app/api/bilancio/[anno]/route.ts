import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ anno: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { anno: annoParam } = await context.params;
    const anno = parseInt(annoParam, 10);

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const dateFilter = {
      gte: new Date(anno, 0, 1),
      lte: new Date(anno, 11, 31),
    };

    // Get all operations with a conto assigned for this year
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        codiceContoId: { not: null },
        dataOperazione: dateFilter,
      },
      include: {
        codiceConto: true,
      },
    });

    // Count totals
    const [totale, conDatiContabili] = await Promise.all([
      prisma.operazione.count({
        where: {
          societaId,
          eliminato: false,
          dataOperazione: dateFilter,
        },
      }),
      prisma.operazione.count({
        where: {
          societaId,
          eliminato: false,
          codiceContoId: { not: null },
          dataOperazione: dateFilter,
        },
      }),
    ]);

    // Aggregate by voceCe for Conto Economico
    const ceMap = new Map<string, { codice: string; descrizione: string; voce: string; importo: number }>();
    // Aggregate by voceSp for Stato Patrimoniale
    const spAttivoMap = new Map<string, { codice: string; descrizione: string; voce: string; importo: number }>();
    const spPassivoMap = new Map<string, { codice: string; descrizione: string; voce: string; importo: number }>();

    for (const op of operazioni) {
      const conto = op.codiceConto!;
      const importo = Number(op.importoTotale);

      // Conto Economico aggregation
      if (conto.voceCe) {
        const key = `${conto.codice}|${conto.voceCe}`;
        const existing = ceMap.get(key);
        if (existing) {
          existing.importo += importo;
        } else {
          ceMap.set(key, {
            codice: conto.codice,
            descrizione: conto.descrizione,
            voce: conto.voceCe,
            importo,
          });
        }
      }

      // Stato Patrimoniale aggregation
      if (conto.voceSp) {
        const targetMap = conto.tipo === "PATRIMONIALE_PASSIVO" ? spPassivoMap :
                         conto.tipo === "PATRIMONIALE_ATTIVO" ? spAttivoMap :
                         // For ambiguous types, use naturaSaldo
                         conto.naturaSaldo === "DARE" ? spAttivoMap : spPassivoMap;

        const key = `${conto.codice}|${conto.voceSp}`;
        const existing = targetMap.get(key);
        if (existing) {
          existing.importo += importo;
        } else {
          targetMap.set(key, {
            codice: conto.codice,
            descrizione: conto.descrizione,
            voce: conto.voceSp,
            importo,
          });
        }
      }
    }

    // Round all amounts
    const roundVoci = (map: Map<string, { codice: string; descrizione: string; voce: string; importo: number }>) =>
      Array.from(map.values()).map((v) => ({
        ...v,
        importo: Math.round(v.importo * 100) / 100,
      }));

    const ceVoci = roundVoci(ceMap);
    const spAttivoVoci = roundVoci(spAttivoMap);
    const spPassivoVoci = roundVoci(spPassivoMap);

    // Calculate risultatoNetto (ricavi - costi)
    let totaleRicavi = 0;
    let totaleCosti = 0;
    for (const op of operazioni) {
      const conto = op.codiceConto!;
      const importo = Number(op.importoTotale);
      if (conto.tipo === "ECONOMICO_RICAVO") {
        totaleRicavi += importo;
      } else if (conto.tipo === "ECONOMICO_COSTO") {
        totaleCosti += importo;
      }
    }
    const risultatoNetto = Math.round((totaleRicavi - totaleCosti) * 100) / 100;

    return NextResponse.json({
      anno,
      operazioniTotali: totale,
      operazioniConDatiContabili: conDatiContabili,
      contoEconomico: {
        voci: ceVoci,
        risultatoNetto,
      },
      statoPatrimoniale: {
        attivo: spAttivoVoci,
        passivo: spPassivoVoci,
      },
    });
  } catch (error) {
    console.error("Errore nel calcolo bilancio provvisorio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
