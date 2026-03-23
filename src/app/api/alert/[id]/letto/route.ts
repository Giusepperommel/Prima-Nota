import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const alertId = parseInt(id, 10);

    if (isNaN(alertId)) {
      return NextResponse.json(
        { error: "ID alert non valido" },
        { status: 400 }
      );
    }

    const existing = await prisma.alertAzienda.findFirst({
      where: { id: alertId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Alert non trovato" },
        { status: 404 }
      );
    }

    const alert = await prisma.alertAzienda.update({
      where: { id: alertId },
      data: { letto: true },
    });

    return NextResponse.json({
      ...alert,
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento dell'alert:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
