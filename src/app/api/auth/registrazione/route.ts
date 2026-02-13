import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { inviaOtpEmail } from "@/lib/email";

const registrazioneSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio").max(100),
  cognome: z.string().min(1, "Cognome obbligatorio").max(100),
  email: z.email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registrazioneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { nome, cognome, email, password } = parsed.data;

    // Verifica email non già registrata
    const esistente = await prisma.utente.findUnique({
      where: { email },
    });

    if (esistente) {
      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Crea Socio + Utente in transazione
    await prisma.$transaction(async (tx) => {
      const socio = await tx.socio.create({
        data: {
          nome,
          cognome,
          email,
          codiceFiscale: "",
          quotaPercentuale: 0,
          ruolo: "ADMIN",
          societaId: null,
        },
      });

      await tx.utente.create({
        data: {
          socioId: socio.id,
          email,
          passwordHash,
          emailVerificata: false,
        },
      });
    });

    // Genera codice OTP 5 cifre
    const codice = String(crypto.randomInt(10000, 100000));

    // Salva codice in DB
    await prisma.verificaEmail.create({
      data: {
        email,
        codice,
        scadenza: new Date(Date.now() + 60 * 60 * 1000), // +1 ora
      },
    });

    // Invia email
    await inviaOtpEmail(email, nome, codice);

    return NextResponse.json(
      { message: "Registrazione completata. Controlla la tua email per il codice di verifica." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore registrazione:", error);
    return NextResponse.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
