import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategorieDefault } from "@/lib/categorie-default";

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
      codiceFiscaleSocieta,
      indirizzo,
      regimeFiscale,
      tipoAttivita,
      capitaleSociale,
      dataCostituzione,
      socio,
    } = body;

    // Validazione campi obbligatori societa
    if (!ragioneSociale || !partitaIva || !codiceFiscaleSocieta) {
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

    // Validazione formato codice fiscale societa (11 o 16 caratteri)
    if (!/^[A-Z0-9]{11,16}$/i.test(codiceFiscaleSocieta)) {
      return NextResponse.json(
        { error: "Il codice fiscale della societa non e' valido" },
        { status: 400 }
      );
    }

    // Validazione dati socio
    if (!socio?.nomeSocio?.trim() || !socio?.quotaPercentuale || !socio?.dataIngresso) {
      return NextResponse.json(
        { error: "Nome socio, quota percentuale e data ingresso sono obbligatori" },
        { status: 400 }
      );
    }

    if (socio.quotaPercentuale <= 0 || socio.quotaPercentuale > 100) {
      return NextResponse.json(
        { error: "La quota percentuale deve essere tra 0.01 e 100" },
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

    // Crea societa, aggiorna socio e crea categorie in una transazione
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crea la societa
      const nuovaSocieta = await tx.societa.create({
        data: {
          ragioneSociale,
          partitaIva,
          codiceFiscale: codiceFiscaleSocieta,
          indirizzo: indirizzo || null,
          tipoAttivita: tipoAttivita || "SRL",
          regimeFiscale: regimeFiscale || "ORDINARIO",
          capitaleSociale: capitaleSociale != null ? capitaleSociale : null,
          dataCostituzione: dataCostituzione
            ? new Date(dataCostituzione)
            : null,
        },
      });

      // 2. Aggiorna il socio: associa alla societa, ruolo ADMIN, dati personali
      const [nome, ...cognomeParts] = socio.nomeSocio.trim().split(" ");
      const cognome = cognomeParts.join(" ") || nome;
      await tx.socio.update({
        where: { id: user.socioId },
        data: {
          societaId: nuovaSocieta.id,
          ruolo: "ADMIN",
          nome,
          cognome,
          quotaPercentuale: socio.quotaPercentuale,
          dataIngresso: new Date(socio.dataIngresso),
        },
      });

      // 3. Crea le categorie di spesa standard
      const categorieDefault = getCategorieDefault(
        tipoAttivita || "SRL",
        regimeFiscale || "ORDINARIO"
      );

      await tx.categoriaSpesa.createMany({
        data: categorieDefault.map((c) => ({
          societaId: nuovaSocieta.id,
          nome: c.nome,
          percentualeDeducibilita: c.percentualeDeducibilita,
          descrizione: c.descrizione || null,
          tipoCategoria: c.tipoCategoria,
          aliquotaIvaDefault: c.aliquotaIvaDefault,
          percentualeDetraibilitaIva: c.percentualeDetraibilitaIva,
          haOpzioniUso: c.haOpzioniUso,
          opzioniUso: c.opzioniUso ?? Prisma.JsonNull,
        })),
      });

      return nuovaSocieta;
    });

    const categorieCount = getCategorieDefault(
      tipoAttivita || "SRL",
      regimeFiscale || "ORDINARIO"
    ).length;

    return NextResponse.json({
      societaId: result.id,
      ragioneSociale: result.ragioneSociale,
      categorieCreate: categorieCount,
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
      aliquotaIrap,
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
        aliquotaIrap: aliquotaIrap != null ? aliquotaIrap : 3.9,
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
