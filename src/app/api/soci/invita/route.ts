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
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    const body = await request.json();
    const { email, ruolo, quotaPercentuale, codiceFiscale, dataIngresso } = body;

    // Validazione
    if (!email) {
      return NextResponse.json(
        { error: "L'email e' obbligatoria" },
        { status: 400 }
      );
    }

    if (quotaPercentuale == null || quotaPercentuale <= 0 || quotaPercentuale > 100) {
      return NextResponse.json(
        { error: "La quota percentuale deve essere tra 0.01 e 100" },
        { status: 400 }
      );
    }

    if (ruolo && !["ADMIN", "STANDARD"].includes(ruolo)) {
      return NextResponse.json(
        { error: "Il ruolo deve essere ADMIN o STANDARD" },
        { status: 400 }
      );
    }

    // Cerca il socio con questa email
    const socio = await prisma.socio.findUnique({
      where: { email },
      include: {
        utente: { select: { emailVerificata: true } },
      },
    });

    if (!socio) {
      return NextResponse.json(
        { error: "Nessun utente registrato con questa email" },
        { status: 404 }
      );
    }

    if (!socio.utente) {
      return NextResponse.json(
        { error: "L'utente non ha un account attivo" },
        { status: 400 }
      );
    }

    if (!socio.utente.emailVerificata) {
      return NextResponse.json(
        { error: "L'utente non ha ancora verificato la sua email" },
        { status: 400 }
      );
    }

    if (socio.societaId !== null) {
      return NextResponse.json(
        { error: "L'utente e' gia associato a una societa" },
        { status: 409 }
      );
    }

    if (!socio.attivo) {
      return NextResponse.json(
        { error: "L'utente e' disattivato" },
        { status: 400 }
      );
    }

    // Controllo somma quote
    const sociAttivi = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { quotaPercentuale: true },
    });

    const sommaQuoteAttuali = sociAttivi.reduce(
      (sum, s) => sum + Number(s.quotaPercentuale),
      0
    );

    const nuovaSomma = sommaQuoteAttuali + quotaPercentuale;

    // Associa il socio alla societa
    const socioAggiornato = await prisma.socio.update({
      where: { id: socio.id },
      data: {
        societaId,
        ruolo: ruolo || "STANDARD",
        quotaPercentuale,
        codiceFiscale: codiceFiscale || socio.codiceFiscale,
        dataIngresso: dataIngresso ? new Date(dataIngresso) : new Date(),
      },
    });

    const warningQuote =
      Math.abs(nuovaSomma - 100) > 0.001
        ? `Attenzione: la somma delle quote dei soci attivi e' ${nuovaSomma.toFixed(2)}% (dovrebbe essere 100%)`
        : null;

    return NextResponse.json({
      id: socioAggiornato.id,
      nome: socioAggiornato.nome,
      cognome: socioAggiornato.cognome,
      email: socioAggiornato.email,
      codiceFiscale: socioAggiornato.codiceFiscale,
      quotaPercentuale: Number(socioAggiornato.quotaPercentuale),
      ruolo: socioAggiornato.ruolo,
      dataIngresso: socioAggiornato.dataIngresso?.toISOString().split("T")[0] ?? null,
      attivo: socioAggiornato.attivo,
      societaId: socioAggiornato.societaId,
      warningQuote,
    });
  } catch (error) {
    console.error("Errore nell'invito del socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
