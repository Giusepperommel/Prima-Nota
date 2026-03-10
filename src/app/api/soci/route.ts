import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    } = body;

    // Validazione campi obbligatori
    if (!nome) {
      return NextResponse.json(
        { error: "Il nome del socio e' obbligatorio" },
        { status: 400 }
      );
    }

    // Validazione email (se fornita)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Formato email non valido" },
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
    }

    // Validazione quota percentuale (se fornita)
    const quota = quotaPercentuale != null ? parseFloat(quotaPercentuale) : 0;
    if (quota < 0 || quota > 100) {
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

    // Crea il socio (senza account utente - il socio potra' registrarsi autonomamente)
    const nuovoSocio = await prisma.socio.create({
      data: {
        societaId,
        nome,
        cognome: cognome || "",
        codiceFiscale: codiceFiscale || "",
        email: email || `socio-${Date.now()}@placeholder.local`,
        quotaPercentuale: quota,
        ruolo: ruolo || "STANDARD",
        dataIngresso: dataIngresso ? new Date(dataIngresso) : null,
        attivo: true,
      },
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
