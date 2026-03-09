import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Categorie spesa standard italiane create automaticamente per ogni nuova societa
const CATEGORIE_DEFAULT = [
  { nome: "Carburante auto", perc: 20.0, desc: "Art. 164 comma 1 TUIR - Uso promiscuo", tipo: "Auto" },
  { nome: "Telefonia mobile", perc: 80.0, desc: "Uso promiscuo professionale/personale", tipo: "Telecomunicazioni" },
  { nome: "Telefonia fissa ufficio", perc: 100.0, desc: "Uso esclusivo professionale", tipo: "Telecomunicazioni" },
  { nome: "Formazione e aggiornamento professionale", perc: 100.0, desc: "Corsi, seminari, libri tecnici", tipo: "Formazione" },
  { nome: "Cancelleria e materiale ufficio", perc: 100.0, desc: "", tipo: "Ufficio" },
  { nome: "Software e licenze", perc: 100.0, desc: "Abbonamenti cloud, licenze software", tipo: "IT" },
  { nome: "Hardware e computer", perc: 100.0, desc: "Beni ammortizzabili", tipo: "IT" },
  { nome: "Affitto ufficio", perc: 100.0, desc: "", tipo: "Immobili" },
  { nome: "Utenze ufficio (luce, gas, acqua)", perc: 100.0, desc: "", tipo: "Immobili" },
  { nome: "Pulizie ufficio", perc: 100.0, desc: "", tipo: "Immobili" },
  { nome: "Consulenze professionali", perc: 100.0, desc: "Commercialista, legale, tecnici", tipo: "Servizi" },
  { nome: "Spese bancarie e commissioni", perc: 100.0, desc: "", tipo: "Banca" },
  { nome: "Assicurazioni professionali", perc: 100.0, desc: "", tipo: "Assicurazioni" },
  { nome: "Marketing e pubblicita", perc: 100.0, desc: "", tipo: "Marketing" },
  { nome: "Rappresentanza", perc: 75.0, desc: "Limiti art. 108 TUIR - percentuale indicativa", tipo: "Rappresentanza" },
  { nome: "Manutenzione auto", perc: 20.0, desc: "Coerente con uso promiscuo carburante", tipo: "Auto" },
  { nome: "Assicurazione auto", perc: 20.0, desc: "Coerente con uso promiscuo", tipo: "Auto" },
  { nome: "Mobili e arredi", perc: 100.0, desc: "Beni ammortizzabili", tipo: "Ufficio" },
  { nome: "Viaggi e trasferte", perc: 100.0, desc: "Se documentati e inerenti attivita", tipo: "Trasferte" },
  { nome: "Vitto e alloggio trasferte", perc: 75.0, desc: "Limiti fiscali secondo normativa", tipo: "Trasferte" },
];

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
    if (!socio?.codiceFiscale || !socio?.quotaPercentuale || !socio?.dataIngresso) {
      return NextResponse.json(
        { error: "Codice fiscale, quota percentuale e data ingresso del socio sono obbligatori" },
        { status: 400 }
      );
    }

    if (!/^[A-Z0-9]{16}$/i.test(socio.codiceFiscale)) {
      return NextResponse.json(
        { error: "Il codice fiscale personale deve essere di 16 caratteri" },
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
          regimeFiscale: regimeFiscale || null,
          capitaleSociale: capitaleSociale != null ? capitaleSociale : null,
          dataCostituzione: dataCostituzione
            ? new Date(dataCostituzione)
            : null,
        },
      });

      // 2. Aggiorna il socio: associa alla societa, ruolo ADMIN, dati personali
      await tx.socio.update({
        where: { id: user.socioId },
        data: {
          societaId: nuovaSocieta.id,
          ruolo: "ADMIN",
          codiceFiscale: socio.codiceFiscale,
          quotaPercentuale: socio.quotaPercentuale,
          dataIngresso: new Date(socio.dataIngresso),
        },
      });

      // 3. Crea le categorie di spesa standard
      await tx.categoriaSpesa.createMany({
        data: CATEGORIE_DEFAULT.map((c) => ({
          societaId: nuovaSocieta.id,
          nome: c.nome,
          percentualeDeducibilita: c.perc,
          descrizione: c.desc || null,
          tipoCategoria: c.tipo,
        })),
      });

      return nuovaSocieta;
    });

    return NextResponse.json({
      societaId: result.id,
      ragioneSociale: result.ragioneSociale,
      categorieCreate: CATEGORIE_DEFAULT.length,
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
