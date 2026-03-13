import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { inviaResetPasswordEmail } from "@/lib/email";

const schema = z.object({
  email: z.email("Email non valida"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email non valida" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Non rivelare se l'email esiste o meno
    const genericResponse = NextResponse.json(
      { message: "Se l'email è registrata, riceverai un codice di reset." },
      { status: 200 }
    );

    const utente = await prisma.utente.findUnique({
      where: { email },
      include: { socio: true },
    });

    if (!utente) {
      return genericResponse;
    }

    // Rate limit: 60 secondi tra richieste
    const ultimoReset = await prisma.resetPassword.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (ultimoReset) {
      const secondiPassati = (Date.now() - ultimoReset.createdAt.getTime()) / 1000;
      if (secondiPassati < 60) {
        return NextResponse.json(
          { error: `Attendi ${Math.ceil(60 - secondiPassati)} secondi prima di richiedere un nuovo codice.` },
          { status: 429 }
        );
      }
    }

    // Invalida vecchi codici
    await prisma.resetPassword.updateMany({
      where: { email, utilizzato: false },
      data: { utilizzato: true },
    });

    // Genera nuovo codice
    const codice = String(crypto.randomInt(10000, 100000));

    await prisma.resetPassword.create({
      data: {
        email,
        codice,
        scadenza: new Date(Date.now() + 60 * 60 * 1000), // 1 ora
      },
    });

    await inviaResetPasswordEmail(email, utente.socio.nome, codice);

    return genericResponse;
  } catch (error) {
    console.error("Errore richiesta reset password:", error);
    return NextResponse.json(
      { error: "Errore durante la richiesta di reset" },
      { status: 500 }
    );
  }
}
