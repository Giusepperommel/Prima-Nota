import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const search = searchParams.get("search");

    const where: Prisma.AnagraficaWhereInput = {
      societaId,
    };

    if (tipo) {
      where.tipo = tipo as any;
    }

    if (search) {
      where.OR = [
        { denominazione: { contains: search } },
        { partitaIva: { contains: search } },
      ];
    }

    const data = await prisma.anagrafica.findMany({
      where,
      orderBy: { denominazione: "asc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Errore nel recupero delle anagrafiche:", error);
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

    const body = await request.json();

    const {
      denominazione,
      tipoSoggetto,
      tipo,
      partitaIva,
      codiceFiscale,
      indirizzo,
      cap,
      citta,
      provincia,
      nazione,
      codiceDestinatario,
      pec,
      regimeFiscale,
      soggettoARitenuta,
      regimeForfettario,
      tipoRitenuta,
    } = body;

    // Required fields
    if (!denominazione || !tipoSoggetto || !tipo) {
      return NextResponse.json(
        { error: "Denominazione, tipo soggetto e tipo sono obbligatori" },
        { status: 400 }
      );
    }

    // Validate P.IVA if provided
    if (partitaIva != null && partitaIva !== "") {
      if (!/^\d{11}$/.test(partitaIva)) {
        return NextResponse.json(
          { error: "La Partita IVA deve essere di esattamente 11 cifre" },
          { status: 400 }
        );
      }
    }

    const anagrafica = await prisma.anagrafica.create({
      data: {
        societaId,
        denominazione,
        tipoSoggetto: tipoSoggetto as any,
        tipo: tipo as any,
        partitaIva: partitaIva || null,
        codiceFiscale: codiceFiscale || null,
        indirizzo: indirizzo || null,
        cap: cap || null,
        citta: citta || null,
        provincia: provincia || null,
        nazione: nazione || null,
        codiceDestinatario: codiceDestinatario || null,
        pec: pec || null,
        regimeFiscale: regimeFiscale || null,
        soggettoARitenuta: Boolean(soggettoARitenuta),
        regimeForfettario: Boolean(regimeForfettario),
        tipoRitenuta: tipoRitenuta || null,
      },
    });

    return NextResponse.json(anagrafica, { status: 201 });
  } catch (error) {
    console.error("Errore nella creazione dell'anagrafica:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
