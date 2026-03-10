import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;

    const preferenze = await prisma.preferenzaUsoCategoria.findMany({
      where: { userId: user.id as number },
    });

    return NextResponse.json(preferenze);
  } catch (error) {
    console.error("Errore nel recupero delle preferenze uso:", error);
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
    const body = await request.json();
    const { categoriaId, opzioneUso } = body;

    if (!categoriaId || !opzioneUso) {
      return NextResponse.json(
        { error: "categoriaId e opzioneUso sono obbligatori" },
        { status: 400 }
      );
    }

    const preferenza = await prisma.preferenzaUsoCategoria.upsert({
      where: {
        userId_categoriaId: {
          userId: user.id as number,
          categoriaId: parseInt(String(categoriaId), 10),
        },
      },
      update: { opzioneUso },
      create: {
        userId: user.id as number,
        categoriaId: parseInt(String(categoriaId), 10),
        opzioneUso,
      },
    });

    return NextResponse.json(preferenza);
  } catch (error) {
    console.error("Errore nell'aggiornamento della preferenza uso:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
