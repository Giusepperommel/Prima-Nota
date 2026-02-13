import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";

const verificaSchema = z.object({
  email: z.email("Email non valida"),
  codice: z.string().length(5, "Il codice deve essere di 5 cifre"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verificaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, codice } = parsed.data;

    // Cerca ultimo codice non verificato e non scaduto
    const verifica = await prisma.verificaEmail.findFirst({
      where: {
        email,
        verificato: false,
        scadenza: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verifica) {
      return NextResponse.json(
        { error: "Codice scaduto o non trovato. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    // Controlla tentativi
    if (verifica.tentativi >= 5) {
      return NextResponse.json(
        { error: "Troppi tentativi errati. Richiedi un nuovo codice." },
        { status: 429 }
      );
    }

    // Verifica codice
    if (verifica.codice !== codice) {
      await prisma.verificaEmail.update({
        where: { id: verifica.id },
        data: { tentativi: verifica.tentativi + 1 },
      });

      const tentativiRimasti = 4 - verifica.tentativi;
      return NextResponse.json(
        { error: `Codice errato. ${tentativiRimasti} tentativi rimasti.` },
        { status: 400 }
      );
    }

    // Codice corretto: aggiorna tutto in transazione
    await prisma.$transaction([
      prisma.verificaEmail.update({
        where: { id: verifica.id },
        data: { verificato: true },
      }),
      prisma.utente.updateMany({
        where: { email },
        data: { emailVerificata: true },
      }),
    ]);

    return NextResponse.json(
      { message: "Email verificata con successo! Ora puoi accedere." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore verifica email:", error);
    return NextResponse.json(
      { error: "Errore durante la verifica" },
      { status: 500 }
    );
  }
}
