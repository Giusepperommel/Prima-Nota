import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID ritenuta non valido" },
        { status: 400 }
      );
    }

    // Verify ritenuta exists and belongs to user's societa
    const ritenuta = await prisma.ritenuta.findFirst({
      where: { id, societaId: user.societaId },
    });

    if (!ritenuta) {
      return NextResponse.json(
        { error: "Ritenuta non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { dataVersamento, importoVersato } = body;

    if (!dataVersamento || importoVersato == null) {
      return NextResponse.json(
        { error: "dataVersamento e importoVersato sono obbligatori" },
        { status: 400 }
      );
    }

    const updated = await prisma.ritenuta.update({
      where: { id },
      data: {
        dataVersamento: new Date(dataVersamento),
        importoVersato: parseFloat(String(importoVersato)),
        statoVersamento: "VERSATO",
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      statoVersamento: updated.statoVersamento,
      dataVersamento: updated.dataVersamento,
      importoVersato: Number(updated.importoVersato),
    });
  } catch (error) {
    console.error("Errore nel versamento della ritenuta:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
