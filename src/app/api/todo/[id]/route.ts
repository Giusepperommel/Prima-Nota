import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/todo/[id]
 * Aggiorna lo stato di un todo.
 * Body: { stato: "IN_CORSO"|"COMPLETATA"|"SALTATA" }
 * Imposta completataAt su COMPLETATA.
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
    const todoId = parseInt(id, 10);

    if (isNaN(todoId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const todo = await prisma.todoGenerato.findFirst({
      where: { id: todoId, utenteId: user.id },
    });

    if (!todo) {
      return NextResponse.json({ error: "Todo non trovato" }, { status: 404 });
    }

    const body = await request.json();
    const { stato } = body; // "IN_CORSO" | "COMPLETATA" | "SALTATA"

    if (!["IN_CORSO", "COMPLETATA", "SALTATA"].includes(stato)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }

    const updated = await prisma.todoGenerato.update({
      where: { id: todoId },
      data: {
        stato,
        completataAt: stato === "COMPLETATA" ? new Date() : null,
      },
    });

    return NextResponse.json({ todo: updated });
  } catch (error) {
    console.error("Errore PATCH /api/todo/[id]:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
