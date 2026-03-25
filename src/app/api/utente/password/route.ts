import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const user = session.user as any;
    const { passwordAttuale, nuovaPassword } = await request.json();

    if (!passwordAttuale || !nuovaPassword) {
      return NextResponse.json({ error: "Tutti i campi sono obbligatori" }, { status: 400 });
    }

    if (nuovaPassword.length < 8) {
      return NextResponse.json({ error: "La password deve essere di almeno 8 caratteri" }, { status: 400 });
    }

    const utente = await prisma.utente.findUnique({ where: { id: user.id } });
    if (!utente) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    const passwordMatch = await bcrypt.compare(passwordAttuale, utente.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Password attuale non corretta" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(nuovaPassword, 10);
    await prisma.utente.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[utente/password]", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
