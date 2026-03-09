import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const soci = await prisma.socio.findMany({
      where: { societaId },
      orderBy: [{ attivo: "desc" }, { cognome: "asc" }, { nome: "asc" }],
      include: {
        utente: {
          select: { id: true, ultimoAccesso: true },
        },
      },
    });

    // Serializza Decimal in number per il client
    const serialized = soci.map(({ utente, ...s }) => ({
      ...s,
      quotaPercentuale: Number(s.quotaPercentuale),
      hasAccount: !!utente,
      ultimoAccesso: utente?.ultimoAccesso?.toISOString() ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero dei soci:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
      nome,
      cognome,
      codiceFiscale,
      email,
      quotaPercentuale,
      ruolo,
      dataIngresso,
      password,
    } = body;

    // Validazione campi obbligatori
    if (!nome || !cognome || !codiceFiscale || !email || quotaPercentuale == null || !password) {
      return NextResponse.json(
        { error: "Tutti i campi obbligatori devono essere compilati (nome, cognome, codice fiscale, email, quota, password)" },
        { status: 400 }
      );
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato email non valido" },
        { status: 400 }
      );
    }

    // Validazione quota percentuale
    const quota = parseFloat(quotaPercentuale);
    if (isNaN(quota) || quota < 0 || quota > 100) {
      return NextResponse.json(
        { error: "La quota percentuale deve essere compresa tra 0 e 100" },
        { status: 400 }
      );
    }

    // Validazione ruolo
    if (ruolo && !["ADMIN", "STANDARD"].includes(ruolo)) {
      return NextResponse.json(
        { error: "Il ruolo deve essere ADMIN o STANDARD" },
        { status: 400 }
      );
    }

    // Validazione password
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La password deve avere almeno 8 caratteri" },
        { status: 400 }
      );
    }

    // Verifica unicita' email nel modello Socio
    const existingEmail = await prisma.socio.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Esiste gia' un socio con questa email" },
        { status: 409 }
      );
    }

    // Verifica unicita' email nel modello Utente
    const existingUtente = await prisma.utente.findUnique({
      where: { email },
    });

    if (existingUtente) {
      return NextResponse.json(
        { error: "Esiste gia' un utente con questa email" },
        { status: 409 }
      );
    }

    // Controllo somma quote dei soci attivi
    const sociAttivi = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { quotaPercentuale: true },
    });

    const sommaQuoteAttuali = sociAttivi.reduce(
      (sum, s) => sum + Number(s.quotaPercentuale),
      0
    );

    const nuovaSomma = sommaQuoteAttuali + quota;

    // Hash della password
    const passwordHash = await bcrypt.hash(password, 12);

    // Crea socio e utente in una transazione
    const nuovoSocio = await prisma.$transaction(async (tx) => {
      const socio = await tx.socio.create({
        data: {
          societaId,
          nome,
          cognome,
          codiceFiscale,
          email,
          quotaPercentuale: quota,
          ruolo: ruolo || "STANDARD",
          dataIngresso: dataIngresso ? new Date(dataIngresso) : null,
          attivo: true,
        },
      });

      await tx.utente.create({
        data: {
          socioId: socio.id,
          email,
          passwordHash,
        },
      });

      return socio;
    });

    // Avviso sulle quote
    const warningQuote =
      Math.abs(nuovaSomma - 100) > 0.001
        ? `Attenzione: la somma delle quote dei soci attivi e' ${nuovaSomma.toFixed(2)}% (dovrebbe essere 100%)`
        : null;

    return NextResponse.json(
      {
        ...nuovoSocio,
        quotaPercentuale: Number(nuovoSocio.quotaPercentuale),
        warningQuote,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione del socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
