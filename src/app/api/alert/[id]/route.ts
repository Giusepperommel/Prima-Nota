import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/alert/[id]
 * Aggiorna lo stato di un alert.
 * Body: { azione: "visto"|"snooze"|"risolvi", ore?: number }
 * Verifica che l'alert appartenga all'utente corrente.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;
    const alertId = parseInt(id, 10);

    if (isNaN(alertId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const alert = await prisma.alertGenerato.findFirst({
      where: { id: alertId, utenteDestinatarioId: user.id },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert non trovato" }, { status: 404 });
    }

    const body = await request.json();
    const { azione } = body; // "visto" | "snooze" | "risolvi"

    const updateData: any = {};
    switch (azione) {
      case "visto":
        updateData.stato = "VISTO";
        break;
      case "snooze": {
        const ore = body.ore || 24;
        updateData.stato = "SNOOZED";
        updateData.snoozeFinoA = new Date(Date.now() + ore * 3600000);
        break;
      }
      case "risolvi":
        updateData.stato = "RISOLTO";
        updateData.risoltoAt = new Date();
        break;
      default:
        return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    const updated = await prisma.alertGenerato.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error("Errore PATCH /api/alert/[id]:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
