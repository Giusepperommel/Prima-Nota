import { NextResponse } from "next/server";
import crypto from "crypto";
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
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "L'email e' obbligatoria" },
        { status: 400 }
      );
    }

    // Cerca se l'utente esiste gia'
    const utente = await prisma.utente.findUnique({
      where: { email },
      select: { id: true, emailVerificata: true },
    });

    if (utente) {
      // Utente esiste: verifica che non abbia gia' accesso
      const esisteUtenteAzienda = await prisma.utenteAzienda.findUnique({
        where: { utenteId_societaId: { utenteId: utente.id, societaId } },
      });

      if (esisteUtenteAzienda) {
        return NextResponse.json(
          { error: "L'utente ha gia' accesso a questa azienda" },
          { status: 409 }
        );
      }

      // Crea UtenteAzienda con ruolo COMMERCIALISTA (nessun Socio)
      await prisma.utenteAzienda.create({
        data: {
          utenteId: utente.id,
          societaId,
          ruolo: "COMMERCIALISTA",
        },
      });

      return NextResponse.json({
        success: true,
        email,
        ruolo: "COMMERCIALISTA",
      });
    }

    // Utente non esiste: crea invito pendente
    // Prima controlla se esiste gia' un invito non accettato per questa email/azienda
    const invitoEsistente = await prisma.invitoAzienda.findUnique({
      where: { societaId_email: { societaId, email } },
    });

    if (invitoEsistente && !invitoEsistente.accettato) {
      return NextResponse.json(
        { error: "Esiste gia' un invito pendente per questa email" },
        { status: 409 }
      );
    }

    const token = crypto.randomUUID();
    const scadenza = new Date();
    scadenza.setDate(scadenza.getDate() + 7);

    await prisma.invitoAzienda.upsert({
      where: { societaId_email: { societaId, email } },
      create: {
        societaId,
        email,
        ruolo: "COMMERCIALISTA",
        token,
        scadenza,
        createdByUtenteId: user.id,
      },
      update: {
        ruolo: "COMMERCIALISTA",
        token,
        scadenza,
        accettato: false,
        createdByUtenteId: user.id,
      },
    });

    return NextResponse.json({
      invitoPendente: true,
      email,
      ruolo: "COMMERCIALISTA",
    });
  } catch (error) {
    console.error("Errore nell'invito del commercialista:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
