import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/dichiarazioni/cu/[id]/export
 * Exports a single CU as structured JSON for the commercialista.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const cu = await prisma.certificazioneUnica.findFirst({
      where: { id, societaId: user.societaId },
      include: {
        anagrafica: {
          select: {
            id: true,
            denominazione: true,
            codiceFiscale: true,
            partitaIva: true,
            indirizzo: true,
            cap: true,
            citta: true,
            provincia: true,
          },
        },
        societa: {
          select: {
            ragioneSociale: true,
            partitaIva: true,
            codiceFiscale: true,
            indirizzo: true,
            cap: true,
            citta: true,
            provincia: true,
          },
        },
      },
    });

    if (!cu) {
      return NextResponse.json({ error: "CU non trovata" }, { status: 404 });
    }

    // Fetch related ritenute for this percipiente and year
    const ritenute = await prisma.ritenuta.findMany({
      where: {
        societaId: user.societaId,
        anagraficaId: cu.anagraficaId,
        annoCompetenza: cu.anno,
      },
      orderBy: { meseCompetenza: "asc" },
    });

    const dettaglioRitenute = ritenute.map((r) => ({
      mese: r.meseCompetenza,
      importoLordo: Number(r.importoLordo),
      baseImponibile: Number(r.baseImponibile),
      importoRitenuta: Number(r.importoRitenuta),
      codiceTributo: r.codiceTributo,
      dataVersamento: r.dataVersamento,
      statoVersamento: r.statoVersamento,
    }));

    const exportData = {
      tipo: "CertificazioneUnica",
      anno: cu.anno,
      dataGenerazione: cu.dataGenerazione,
      sostitutoImposta: {
        ragioneSociale: cu.societa.ragioneSociale,
        partitaIva: cu.societa.partitaIva,
        codiceFiscale: cu.societa.codiceFiscale,
        indirizzo: cu.societa.indirizzo,
        cap: cu.societa.cap,
        citta: cu.societa.citta,
        provincia: cu.societa.provincia,
      },
      percipiente: {
        denominazione: cu.anagrafica.denominazione,
        codiceFiscale: cu.anagrafica.codiceFiscale,
        partitaIva: cu.anagrafica.partitaIva,
        indirizzo: cu.anagrafica.indirizzo,
        cap: cu.anagrafica.cap,
        citta: cu.anagrafica.citta,
        provincia: cu.anagrafica.provincia,
      },
      datiCertificazione: {
        causaleCu: cu.causaleCu,
        ammontareLordo: Number(cu.ammontareLordo),
        imponibile: Number(cu.imponibile),
        ritenutaAcconto: Number(cu.ritenutaAcconto),
        rivalsaInps: Number(cu.rivalsaInps),
        cassaPrevidenza: Number(cu.cassaPrevidenza),
      },
      dettaglioRitenute,
      stato: cu.stato,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Errore export CU:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
