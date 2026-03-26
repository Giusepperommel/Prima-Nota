import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createPortaleToken } from "@/lib/portale/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, societaId } = body;

    if (!email || !password || !societaId) {
      return NextResponse.json(
        { error: "Email, password e societaId sono obbligatori" },
        { status: 400 }
      );
    }

    const accesso = await prisma.accessoCliente.findUnique({
      where: {
        societaId_email: {
          societaId: Number(societaId),
          email,
        },
      },
    });

    if (!accesso) {
      return NextResponse.json(
        { error: "Credenziali non valide" },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, accesso.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Credenziali non valide" },
        { status: 401 }
      );
    }

    // Update last access
    await prisma.accessoCliente.update({
      where: { id: accesso.id },
      data: { ultimoAccesso: new Date() },
    });

    const token = await createPortaleToken({
      accessoClienteId: accesso.id,
      societaId: accesso.societaId,
      ruolo: accesso.ruolo,
    });

    return NextResponse.json({
      token,
      nome: accesso.nome,
      ruolo: accesso.ruolo,
    });
  } catch (error) {
    console.error("Errore login portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
