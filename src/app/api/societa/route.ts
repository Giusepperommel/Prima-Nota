import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;

    // Solo utenti senza societa possono crearne una
    if (user.societaId !== null && user.societaId !== undefined) {
      return NextResponse.json(
        { error: "Sei gia associato a una societa" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      ragioneSociale,
      partitaIva,
      codiceFiscale,
      indirizzo,
      regimeFiscale,
      capitaleSociale,
      dataCostituzione,
    } = body;

    // Validazione campi obbligatori
    if (!ragioneSociale || !partitaIva || !codiceFiscale) {
      return NextResponse.json(
        { error: "Ragione sociale, partita IVA e codice fiscale sono obbligatori" },
        { status: 400 }
      );
    }

    // Validazione formato partita IVA (11 cifre)
    if (!/^\d{11}$/.test(partitaIva)) {
      return NextResponse.json(
        { error: "La partita IVA deve essere composta da 11 cifre" },
        { status: 400 }
      );
    }

    // Validazione formato codice fiscale (11 o 16 caratteri)
    if (!/^[A-Z0-9]{11,16}$/i.test(codiceFiscale)) {
      return NextResponse.json(
        { error: "Il codice fiscale non e' valido" },
        { status: 400 }
      );
    }

    // Verifica unicita partita IVA
    const existingPiva = await prisma.societa.findFirst({
      where: { partitaIva },
    });

    if (existingPiva) {
      return NextResponse.json(
        { error: "Partita IVA gia' in uso da un'altra societa'" },
        { status: 409 }
      );
    }

    // Crea la societa e associa il socio in una transazione
    const result = await prisma.$transaction(async (tx) => {
      const societa = await tx.societa.create({
        data: {
          ragioneSociale,
          partitaIva,
          codiceFiscale,
          indirizzo: indirizzo || null,
          regimeFiscale: regimeFiscale || null,
          capitaleSociale: capitaleSociale != null ? capitaleSociale : null,
          dataCostituzione: dataCostituzione
            ? new Date(dataCostituzione)
            : null,
        },
      });

      // Associa il socio alla nuova societa e promuovi ad ADMIN
      await tx.socio.update({
        where: { id: user.socioId },
        data: {
          societaId: societa.id,
          ruolo: "ADMIN",
        },
      });

      return societa;
    });

    return NextResponse.json({
      societaId: result.id,
      ragioneSociale: result.ragioneSociale,
    });
  } catch (error) {
    console.error("Errore nella creazione della societa:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
    });

    if (!societa) {
      return NextResponse.json(
        { error: "Societa non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(societa);
  } catch (error) {
    console.error("Errore nel recupero della societa:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    const body = await request.json();

    const {
      ragioneSociale,
      partitaIva,
      codiceFiscale,
      indirizzo,
      regimeFiscale,
      capitaleSociale,
      dataCostituzione,
    } = body;

    // Validazione campi obbligatori
    if (!ragioneSociale || !partitaIva || !codiceFiscale) {
      return NextResponse.json(
        { error: "Ragione sociale, partita IVA e codice fiscale sono obbligatori" },
        { status: 400 }
      );
    }

    // Validazione formato partita IVA (11 cifre)
    if (!/^\d{11}$/.test(partitaIva)) {
      return NextResponse.json(
        { error: "La partita IVA deve essere composta da 11 cifre" },
        { status: 400 }
      );
    }

    // Validazione formato codice fiscale (11 o 16 caratteri)
    if (!/^[A-Z0-9]{11,16}$/i.test(codiceFiscale)) {
      return NextResponse.json(
        { error: "Il codice fiscale non e' valido" },
        { status: 400 }
      );
    }

    // Verifica unicita' partita IVA (escludendo la societa' corrente)
    const existingPiva = await prisma.societa.findFirst({
      where: {
        partitaIva,
        NOT: { id: societaId },
      },
    });

    if (existingPiva) {
      return NextResponse.json(
        { error: "Partita IVA gia' in uso da un'altra societa'" },
        { status: 409 }
      );
    }

    const societa = await prisma.societa.update({
      where: { id: societaId },
      data: {
        ragioneSociale,
        partitaIva,
        codiceFiscale,
        indirizzo: indirizzo || null,
        regimeFiscale: regimeFiscale || null,
        capitaleSociale: capitaleSociale != null ? capitaleSociale : null,
        dataCostituzione: dataCostituzione
          ? new Date(dataCostituzione)
          : null,
      },
    });

    return NextResponse.json(societa);
  } catch (error) {
    console.error("Errore nell'aggiornamento della societa:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
