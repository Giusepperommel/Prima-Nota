import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const operazioneId = parseInt(id, 10);

    if (isNaN(operazioneId)) {
      return NextResponse.json(
        { error: "ID operazione non valido" },
        { status: 400 }
      );
    }

    const operazione = await prisma.operazione.findFirst({
      where: {
        id: operazioneId,
        societaId,
        bozza: true,
        eliminato: false,
      },
    });

    if (!operazione) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 }
      );
    }

    // Optionally update importoTotale before confirming
    let updateData: { bozza: boolean; importoTotale?: number } = {
      bozza: false,
    };

    try {
      const body = await request.json();
      if (body.importoTotale != null) {
        const importo = parseFloat(String(body.importoTotale));
        if (isNaN(importo) || importo <= 0) {
          return NextResponse.json(
            { error: "L'importo totale deve essere maggiore di zero" },
            { status: 400 }
          );
        }
        updateData.importoTotale = importo;
      }
    } catch {
      // No body or invalid JSON — proceed without updating importo
    }

    await prisma.operazione.update({
      where: { id: operazioneId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore conferma bozza:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
