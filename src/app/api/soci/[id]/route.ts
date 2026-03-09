import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const socioId = parseInt(id, 10);

    if (isNaN(socioId)) {
      return NextResponse.json(
        { error: "ID socio non valido" },
        { status: 400 }
      );
    }

    const socio = await prisma.socio.findFirst({
      where: { id: socioId, societaId },
    });

    if (!socio) {
      return NextResponse.json(
        { error: "Socio non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...socio,
      quotaPercentuale: Number(socio.quotaPercentuale),
    });
  } catch (error) {
    console.error("Errore nel recupero del socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    const socioId = parseInt(id, 10);

    if (isNaN(socioId)) {
      return NextResponse.json(
        { error: "ID socio non valido" },
        { status: 400 }
      );
    }

    // Verifica che il socio appartenga alla stessa societa
    const existingSocio = await prisma.socio.findFirst({
      where: { id: socioId, societaId },
    });

    if (!existingSocio) {
      return NextResponse.json(
        { error: "Socio non trovato" },
        { status: 404 }
      );
    }

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
      socioLavoratore,
    } = body;

    // Validazione campi obbligatori
    if (!nome || !cognome || !codiceFiscale || !email || quotaPercentuale == null) {
      return NextResponse.json(
        { error: "Tutti i campi obbligatori devono essere compilati" },
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

    // Verifica unicita' email (escludendo il socio corrente)
    if (email !== existingSocio.email) {
      const emailInUse = await prisma.socio.findFirst({
        where: { email, NOT: { id: socioId } },
      });

      if (emailInUse) {
        return NextResponse.json(
          { error: "Esiste gia' un socio con questa email" },
          { status: 409 }
        );
      }
    }

    // Controllo somma quote dei soci attivi (escludendo il socio corrente)
    const altriSociAttivi = await prisma.socio.findMany({
      where: {
        societaId,
        attivo: true,
        NOT: { id: socioId },
      },
      select: { quotaPercentuale: true },
    });

    const sommaAltriQuote = altriSociAttivi.reduce(
      (sum, s) => sum + Number(s.quotaPercentuale),
      0
    );

    // Se il socio che stiamo aggiornando e' attivo, includiamo la nuova quota
    const nuovaSomma = existingSocio.attivo
      ? sommaAltriQuote + quota
      : sommaAltriQuote;

    // Aggiorna socio e utente associato in transazione
    const socioAggiornato = await prisma.$transaction(async (tx) => {
      const socio = await tx.socio.update({
        where: { id: socioId },
        data: {
          nome,
          cognome,
          codiceFiscale,
          email,
          quotaPercentuale: quota,
          ruolo: ruolo || "STANDARD",
          dataIngresso: dataIngresso ? new Date(dataIngresso) : null,
          socioLavoratore: socioLavoratore ?? existingSocio.socioLavoratore,
        },
      });

      // Aggiorna anche l'email dell'utente associato se cambiata
      if (email !== existingSocio.email) {
        await tx.utente.updateMany({
          where: { socioId },
          data: { email },
        });
      }

      // Aggiorna la password se fornita
      if (password && password.length >= 8) {
        const passwordHash = await bcrypt.hash(password, 12);
        await tx.utente.updateMany({
          where: { socioId },
          data: { passwordHash },
        });
      }

      return socio;
    });

    // Avviso sulle quote
    const warningQuote =
      existingSocio.attivo && Math.abs(nuovaSomma - 100) > 0.001
        ? `Attenzione: la somma delle quote dei soci attivi e' ${nuovaSomma.toFixed(2)}% (dovrebbe essere 100%)`
        : null;

    return NextResponse.json({
      ...socioAggiornato,
      quotaPercentuale: Number(socioAggiornato.quotaPercentuale),
      warningQuote,
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento del socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    const socioId = parseInt(id, 10);

    if (isNaN(socioId)) {
      return NextResponse.json(
        { error: "ID socio non valido" },
        { status: 400 }
      );
    }

    // Non permettere di disattivare se stessi
    if (socioId === user.socioId) {
      return NextResponse.json(
        { error: "Non puoi disattivare il tuo stesso account" },
        { status: 400 }
      );
    }

    // Verifica che il socio appartenga alla stessa societa
    const socio = await prisma.socio.findFirst({
      where: { id: socioId, societaId },
    });

    if (!socio) {
      return NextResponse.json(
        { error: "Socio non trovato" },
        { status: 404 }
      );
    }

    if (!socio.attivo) {
      return NextResponse.json(
        { error: "Il socio e' gia' disattivato" },
        { status: 400 }
      );
    }

    // Soft delete: imposta attivo = false
    const socioDisattivato = await prisma.socio.update({
      where: { id: socioId },
      data: { attivo: false },
    });

    // Ricalcola somma quote soci attivi dopo la disattivazione
    const sociAttiviRimanenti = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { quotaPercentuale: true },
    });

    const sommaQuote = sociAttiviRimanenti.reduce(
      (sum, s) => sum + Number(s.quotaPercentuale),
      0
    );

    const warningQuote =
      Math.abs(sommaQuote - 100) > 0.001
        ? `Attenzione: la somma delle quote dei soci attivi e' ${sommaQuote.toFixed(2)}% (dovrebbe essere 100%)`
        : null;

    return NextResponse.json({
      ...socioDisattivato,
      quotaPercentuale: Number(socioDisattivato.quotaPercentuale),
      warningQuote,
    });
  } catch (error) {
    console.error("Errore nella disattivazione del socio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
