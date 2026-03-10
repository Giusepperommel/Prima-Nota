import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAmmortamentoPerSocio } from "@/lib/ammortamento-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const ruolo = user.ruolo as string;
    const societaId = user.societaId as number;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const da = searchParams.get("da");
    const a = searchParams.get("a");

    if (!da || !a) {
      return NextResponse.json(
        { error: "Parametri 'da' e 'a' obbligatori" },
        { status: 400 }
      );
    }

    const dateFilter = {
      dataOperazione: {
        gte: new Date(da),
        lte: new Date(a),
      },
    };

    // Get all soci for this societa
    const soci = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { id: true, nome: true, cognome: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    });

    const result = [];

    for (const socio of soci) {
      // Fatturato for this socio (their share via ripartizioni)
      const fatturatoAgg = await prisma.ripartizioneOperazione.aggregate({
        _sum: { importoCalcolato: true },
        where: {
          socioId: socio.id,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            tipoOperazione: "FATTURA_ATTIVA",
            ...dateFilter,
          },
        },
      });

      // Costi for this socio (their share via ripartizioni)
      const costiAgg = await prisma.ripartizioneOperazione.aggregate({
        _sum: { importoCalcolato: true },
        where: {
          socioId: socio.id,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            tipoOperazione: "COSTO",
            ...dateFilter,
          },
        },
      });

      const fatturato = Number(fatturatoAgg._sum.importoCalcolato ?? 0);
      const costi = Number(costiAgg._sum.importoCalcolato ?? 0);

      result.push({
        socioId: socio.id,
        nome: socio.nome,
        cognome: socio.cognome,
        fatturato: Math.round(fatturato * 100) / 100,
        costi: Math.round(costi * 100) / 100,
        ammortamento: 0,
        utile: Math.round((fatturato - costi) * 100) / 100,
      });
    }

    // Add depreciation per socio
    const annoInizio = new Date(da).getFullYear();
    const annoFine = new Date(a).getFullYear();
    const ammortamentoMap = new Map<number, number>();

    for (let anno = annoInizio; anno <= annoFine; anno++) {
      const ammPerSocio = await getAmmortamentoPerSocio(societaId, anno);
      for (const { socioId, ammortamento } of ammPerSocio) {
        const current = ammortamentoMap.get(socioId) ?? 0;
        ammortamentoMap.set(socioId, current + ammortamento);
      }
    }

    for (const entry of result) {
      const ammSocio = Math.round((ammortamentoMap.get(entry.socioId) ?? 0) * 100) / 100;
      entry.ammortamento = ammSocio;
      entry.costi = Math.round((entry.costi + ammSocio) * 100) / 100;
      entry.utile = Math.round((entry.fatturato - entry.costi) * 100) / 100;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore nel recupero breakdown:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
