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
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const socioId = user.socioId as number;

    const { searchParams } = new URL(request.url);
    const da = searchParams.get("da");
    const a = searchParams.get("a");

    if (!da || !a) {
      return NextResponse.json(
        { error: "I parametri 'da' e 'a' sono obbligatori" },
        { status: 400 }
      );
    }

    const dataInizio = new Date(da);
    const dataFine = new Date(a);

    if (isNaN(dataInizio.getTime()) || isNaN(dataFine.getTime())) {
      return NextResponse.json(
        { error: "Date non valide" },
        { status: 400 }
      );
    }

    // Fetch societa info
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { ragioneSociale: true, partitaIva: true, codiceFiscale: true },
    });

    if (!societa) {
      return NextResponse.json(
        { error: "Societa non trovata" },
        { status: 404 }
      );
    }

    // Fetch all non-deleted operations within the date range
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        bozza: false,
        dataOperazione: {
          gte: dataInizio,
          lte: dataFine,
        },
      },
      include: {
        categoria: { select: { id: true, nome: true } },
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
        },
      },
    });

    // Compute riepilogo
    let fatturato = 0;
    let costi = 0;
    const numOperazioni = operazioni.length;

    for (const op of operazioni) {
      let importo: number;
      if (op.importoImponibile != null) {
        importo = Number(op.importoImponibile);
      } else if (op.aliquotaIva != null && Number(op.aliquotaIva) > 0) {
        importo = Number(op.importoTotale) / (1 + Number(op.aliquotaIva) / 100);
      } else {
        importo = Number(op.importoTotale);
      }
      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        fatturato += importo;
      } else if (op.tipoOperazione === "COSTO") {
        costi += importo;
      }
    }

    fatturato = Math.round(fatturato * 100) / 100;
    let costiDiretti = Math.round(costi * 100) / 100;

    // Add depreciation
    const annoInizio = dataInizio.getFullYear();
    const annoFine = dataFine.getFullYear();

    // Fetch cespiti with depreciation for the period
    const cespitiPeriodo = await prisma.cespite.findMany({
      where: {
        societaId,
        operazione: { eliminato: false, bozza: false },
        quoteAmmortamento: {
          some: { anno: { gte: annoInizio, lte: annoFine } },
        },
      },
      include: {
        quoteAmmortamento: {
          where: { anno: { gte: annoInizio, lte: annoFine } },
          orderBy: { anno: "asc" },
        },
        operazione: {
          include: {
            ripartizioni: {
              include: {
                socio: { select: { id: true, nome: true, cognome: true } },
              },
            },
          },
        },
      },
    });

    let ammortamentoTotale = 0;
    const dettaglioAmmortamento = cespitiPeriodo.map((c) => {
      const quoteTotale = c.quoteAmmortamento.reduce(
        (sum, q) => sum + Number(q.importoQuota), 0
      );
      ammortamentoTotale += quoteTotale;
      return {
        cespiteId: c.id,
        descrizione: c.descrizione,
        valoreIniziale: Number(c.valoreIniziale),
        aliquota: Number(c.aliquotaAmmortamento),
        quotaAnnua: Math.round(quoteTotale * 100) / 100,
        fondoAmmortamento: Number(c.fondoAmmortamento),
        attribuzione: c.operazione.ripartizioni
          .filter((r) => Number(r.percentuale) > 0)
          .map((r) => ({
            nome: r.socio.nome,
            cognome: r.socio.cognome,
            percentuale: Number(r.percentuale),
          })),
      };
    });

    ammortamentoTotale = Math.round(ammortamentoTotale * 100) / 100;
    costi = Math.round((costiDiretti + ammortamentoTotale) * 100) / 100;
    const utile = Math.round((fatturato - costi) * 100) / 100;

    // Compute dettaglio per categoria
    const categoriaMap = new Map<
      number,
      { categoria: string; fatturato: number; costi: number }
    >();

    for (const op of operazioni) {
      if (!op.categoria) continue; // nuovi tipi finanziari: nessuna categoria
      const catId = op.categoriaId!;
      const catNome = op.categoria.nome;
      let importo: number;
      if (op.importoImponibile != null) {
        importo = Number(op.importoImponibile);
      } else if (op.aliquotaIva != null && Number(op.aliquotaIva) > 0) {
        importo = Number(op.importoTotale) / (1 + Number(op.aliquotaIva) / 100);
      } else {
        importo = Number(op.importoTotale);
      }

      if (!categoriaMap.has(catId)) {
        categoriaMap.set(catId, { categoria: catNome, fatturato: 0, costi: 0 });
      }

      const entry = categoriaMap.get(catId)!;
      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        entry.fatturato += importo;
      } else if (op.tipoOperazione === "COSTO") {
        entry.costi += importo;
      }
    }

    const dettaglioPerCategoria = Array.from(categoriaMap.values()).map(
      (entry) => ({
        categoria: entry.categoria,
        fatturato: Math.round(entry.fatturato * 100) / 100,
        costi: Math.round(entry.costi * 100) / 100,
        totale:
          Math.round((entry.fatturato - entry.costi) * 100) / 100,
      })
    );

    dettaglioPerCategoria.sort((a, b) => a.categoria.localeCompare(b.categoria));

    // Compute ripartizione soci from ripartizioni table
    const socioMap = new Map<
      number,
      {
        socioId: number;
        nome: string;
        cognome: string;
        quotaPercentuale: number;
        fatturato: number;
        costi: number;
      }
    >();

    for (const op of operazioni) {
      for (const rip of op.ripartizioni) {
        const sId = rip.socioId;
        const importoCalcolato = Number(rip.importoCalcolato);

        if (!socioMap.has(sId)) {
          socioMap.set(sId, {
            socioId: sId,
            nome: rip.socio.nome,
            cognome: rip.socio.cognome,
            quotaPercentuale: Number(rip.socio.quotaPercentuale),
            fatturato: 0,
            costi: 0,
          });
        }

        const entry = socioMap.get(sId)!;
        if (op.tipoOperazione === "FATTURA_ATTIVA") {
          entry.fatturato += importoCalcolato;
        } else if (
          op.tipoOperazione === "COSTO" ||
          false
        ) {
          entry.costi += importoCalcolato;
        }
      }
    }

    // Add depreciation per socio
    const ammortamentoMap = new Map<number, number>();
    for (let anno = annoInizio; anno <= annoFine; anno++) {
      const ammPerSocio = await getAmmortamentoPerSocio(societaId, anno);
      for (const { socioId: sid, ammortamento } of ammPerSocio) {
        const current = ammortamentoMap.get(sid) ?? 0;
        ammortamentoMap.set(sid, current + ammortamento);
      }
    }

    let ripartizioneSoci = Array.from(socioMap.values()).map((entry) => {
      const ammSocio = Math.round((ammortamentoMap.get(entry.socioId) ?? 0) * 100) / 100;
      const costiSocio = Math.round((entry.costi + ammSocio) * 100) / 100;
      return {
        socioId: entry.socioId,
        nome: entry.nome,
        cognome: entry.cognome,
        quotaPercentuale: entry.quotaPercentuale,
        fatturato: Math.round(entry.fatturato * 100) / 100,
        costi: costiSocio,
        ammortamento: ammSocio,
        utile: Math.round((entry.fatturato - costiSocio) * 100) / 100,
      };
    });

    ripartizioneSoci.sort((a, b) => a.cognome.localeCompare(b.cognome));

    // Standard users can only see their own data in ripartizioneSoci
    if (ruolo === "STANDARD") {
      ripartizioneSoci = ripartizioneSoci.filter(
        (s) => s.socioId === socioId
      );
    }

    return NextResponse.json({
      societa: {
        ragioneSociale: societa.ragioneSociale,
        partitaIva: societa.partitaIva,
        codiceFiscale: societa.codiceFiscale,
      },
      periodo: { da, a },
      riepilogo: {
        fatturato,
        costi,
        ammortamento: ammortamentoTotale,
        utile,
        numOperazioni,
      },
      dettaglioPerCategoria,
      dettaglioAmmortamento,
      ripartizioneSoci,
    });
  } catch (error) {
    console.error("Errore nella generazione del rendiconto:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
