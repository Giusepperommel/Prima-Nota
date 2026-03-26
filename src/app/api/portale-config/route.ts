import { NextRequest, NextResponse } from "next/server";
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

    let config = await prisma.configurazionePortale.findUnique({
      where: { societaId },
    });

    if (!config) {
      config = await prisma.configurazionePortale.create({
        data: { societaId },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Errore configurazione portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await request.json();

    const allowedFields = [
      "portaleAttivo",
      "clientePuoCaricareFatture",
      "clienteVedeSituazioneIva",
      "clienteVedeSaldo",
      "clienteVedeScadenze",
      "reportAutomatici",
      "invioEmailAutomatico",
      "firmaEmail",
      "logoUrl",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const config = await prisma.configurazionePortale.upsert({
      where: { societaId },
      update: data,
      create: { societaId, ...data },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Errore aggiornamento configurazione portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
