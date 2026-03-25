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
    const userId = user.id as number;

    const preferenze = await prisma.preferenzaNotifica.findMany({
      where: { utenteId: userId },
    });

    return NextResponse.json(preferenze);
  } catch (error) {
    console.error("GET /api/notifiche/preferenze error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const body = await req.json();

    const { tipoEvento, canale, abilitato, digestFrequency } = body;

    if (!tipoEvento || !canale) {
      return NextResponse.json(
        { error: "tipoEvento e canale sono obbligatori" },
        { status: 400 },
      );
    }

    const preferenza = await prisma.preferenzaNotifica.upsert({
      where: {
        utenteId_tipoEvento_canale: { utenteId: userId, tipoEvento, canale },
      },
      update: {
        abilitato: abilitato ?? true,
        digestFrequency: digestFrequency ?? "IMMEDIATO",
      },
      create: {
        utenteId: userId,
        tipoEvento,
        canale,
        abilitato: abilitato ?? true,
        digestFrequency: digestFrequency ?? "IMMEDIATO",
      },
    });

    return NextResponse.json(preferenza);
  } catch (error) {
    console.error("PUT /api/notifiche/preferenze error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
