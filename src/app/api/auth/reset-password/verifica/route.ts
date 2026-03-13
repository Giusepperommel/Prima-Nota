import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.email("Email non valida"),
  codice: z.string().length(5, "Il codice deve essere di 5 cifre"),
  nuovaPassword: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dati non validi";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, codice, nuovaPassword } = parsed.data;

    // Trova il codice di reset valido
    const reset = await prisma.resetPassword.findFirst({
      where: {
        email,
        utilizzato: false,
        scadenza: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!reset) {
      return NextResponse.json(
        { error: "Codice scaduto o non valido. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    // Controlla tentativi
    if (reset.tentativi >= 5) {
      await prisma.resetPassword.update({
        where: { id: reset.id },
        data: { utilizzato: true },
      });
      return NextResponse.json(
        { error: "Troppi tentativi. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    // Verifica codice
    if (reset.codice !== codice) {
      await prisma.resetPassword.update({
        where: { id: reset.id },
        data: { tentativi: { increment: 1 } },
      });
      const tentativiRimasti = 4 - reset.tentativi;
      return NextResponse.json(
        { error: `Codice errato. ${tentativiRimasti} tentativ${tentativiRimasti === 1 ? "o rimanente" : "i rimanenti"}.` },
        { status: 400 }
      );
    }

    // Codice corretto: aggiorna password
    const passwordHash = await bcrypt.hash(nuovaPassword, 12);

    await prisma.$transaction([
      prisma.utente.update({
        where: { email },
        data: { passwordHash },
      }),
      prisma.resetPassword.update({
        where: { id: reset.id },
        data: { utilizzato: true },
      }),
    ]);

    return NextResponse.json(
      { message: "Password aggiornata con successo." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore verifica reset password:", error);
    return NextResponse.json(
      { error: "Errore durante il reset della password" },
      { status: 500 }
    );
  }
}
