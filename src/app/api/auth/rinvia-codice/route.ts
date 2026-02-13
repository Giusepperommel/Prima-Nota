import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { inviaOtpEmail } from "@/lib/email";

const rinviaSchema = z.object({
  email: z.email("Email non valida"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = rinviaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email non valida" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Verifica che l'utente esista e non sia già verificato
    const utente = await prisma.utente.findUnique({
      where: { email },
      include: { socio: true },
    });

    if (!utente || utente.emailVerificata) {
      // Non rivelare se l'email esiste o meno
      return NextResponse.json(
        { message: "Se l'email è registrata, riceverai un nuovo codice." },
        { status: 200 }
      );
    }

    // Rate limit: controlla ultimo invio
    const ultimoInvio = await prisma.verificaEmail.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (ultimoInvio) {
      const secondiPassati = (Date.now() - ultimoInvio.createdAt.getTime()) / 1000;
      if (secondiPassati < 60) {
        return NextResponse.json(
          { error: `Attendi ${Math.ceil(60 - secondiPassati)} secondi prima di richiedere un nuovo codice.` },
          { status: 429 }
        );
      }
    }

    // Invalida vecchi codici
    await prisma.verificaEmail.updateMany({
      where: { email, verificato: false },
      data: { verificato: true },
    });

    // Genera e salva nuovo codice
    const codice = String(crypto.randomInt(10000, 100000));

    await prisma.verificaEmail.create({
      data: {
        email,
        codice,
        scadenza: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Invia email
    await inviaOtpEmail(email, utente.socio.nome, codice);

    return NextResponse.json(
      { message: "Nuovo codice inviato. Controlla la tua email." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore reinvio codice:", error);
    return NextResponse.json(
      { error: "Errore durante il reinvio del codice" },
      { status: 500 }
    );
  }
}
