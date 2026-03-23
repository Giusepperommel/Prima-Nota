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

    // Cerca l'utente con questa email
    const utente = await prisma.utente.findUnique({
      where: { email },
      select: { id: true, emailVerificata: true, socioId: true },
    });

    if (!utente) {
      return NextResponse.json(
        { error: "Nessun utente registrato con questa email" },
        { status: 404 }
      );
    }

    if (!utente.emailVerificata) {
      return NextResponse.json(
        { error: "L'utente non ha ancora verificato la sua email" },
        { status: 400 }
      );
    }

    // Verifica che non abbia gia' accesso a questa azienda
    const esisteUtenteAzienda = await prisma.utenteAzienda.findUnique({
      where: { utenteId_societaId: { utenteId: utente.id, societaId } },
    });

    if (esisteUtenteAzienda) {
      return NextResponse.json(
        { error: "L'utente ha gia' accesso a questa azienda" },
        { status: 409 }
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

    // Recupera il socio originale per nome/cognome
    const socioOriginale = await prisma.socio.findUnique({
      where: { id: utente.socioId },
      select: { nome: true, cognome: true, codiceFiscale: true },
    });

    // Crea socio per questa azienda e UtenteAzienda in una transazione
    const result = await prisma.$transaction(async (tx) => {
      // Crea (o riusa) il Socio per questa azienda
      const socioAzienda = await tx.socio.create({
        data: {
          societaId,
          nome: socioOriginale?.nome ?? "",
          cognome: socioOriginale?.cognome ?? "",
          email,
          codiceFiscale: codiceFiscale || socioOriginale?.codiceFiscale || "",
          ruolo: ruolo || "STANDARD",
          quotaPercentuale,
          dataIngresso: dataIngresso ? new Date(dataIngresso) : new Date(),
          utenteId: utente.id,
        },
      });

      // Crea UtenteAzienda
      await tx.utenteAzienda.create({
        data: {
          utenteId: utente.id,
          societaId,
          ruolo: ruolo === "ADMIN" ? "ADMIN" : "STANDARD",
        },
      });

      return socioAzienda;
    });

    const warningQuote =
      Math.abs(nuovaSomma - 100) > 0.001
        ? `Attenzione: la somma delle quote dei soci attivi e' ${nuovaSomma.toFixed(2)}% (dovrebbe essere 100%)`
        : null;

    return NextResponse.json({
      id: result.id,
      nome: result.nome,
      cognome: result.cognome,
      email: result.email,
      codiceFiscale: result.codiceFiscale,
      quotaPercentuale: Number(result.quotaPercentuale),
      ruolo: result.ruolo,
      dataIngresso: result.dataIngresso?.toISOString().split("T")[0] ?? null,
      attivo: result.attivo,
      societaId: result.societaId,
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
