import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const clienti = await prisma.accessoCliente.findMany({
      where: { societaId },
      select: {
        id: true,
        nome: true,
        email: true,
        ruolo: true,
        ultimoAccesso: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clienti);
  } catch (error) {
    console.error("Errore lista clienti portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await request.json();

    const { nome, email, password, ruolo } = body;

    if (!nome || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e password sono obbligatori" },
        { status: 400 }
      );
    }

    // Check for existing client with same email in this societa
    const existing = await prisma.accessoCliente.findUnique({
      where: { societaId_email: { societaId, email } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Esiste gia un accesso con questa email" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const cliente = await prisma.accessoCliente.create({
      data: {
        societaId,
        nome,
        email,
        passwordHash,
        ruolo: ruolo || "TITOLARE",
      },
      select: {
        id: true,
        nome: true,
        email: true,
        ruolo: true,
        createdAt: true,
      },
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    console.error("Errore creazione cliente portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
