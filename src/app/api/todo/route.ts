import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTodosForUser } from "@/lib/intelligence/todo-engine/generator";

/**
 * GET /api/todo
 * Lista todo per l'utente corrente per una data (default oggi).
 * Se non ci sono todo persistiti per oggi, genera quelli live.
 * Query params: data (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const dataParam = searchParams.get("data");
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const data = dataParam ? new Date(dataParam) : oggi;

    // Get persisted todos
    const todos = await prisma.todoGenerato.findMany({
      where: {
        societaId,
        utenteId: user.id,
        data,
      },
      orderBy: [{ priorita: "asc" }, { createdAt: "asc" }],
    });

    // If no todos for today, generate live
    if (todos.length === 0 && data.getTime() === oggi.getTime()) {
      const live = await generateTodosForUser(societaId, user.id);
      return NextResponse.json({ todos: live, live: true });
    }

    return NextResponse.json({ todos, live: false });
  } catch (error) {
    console.error("Errore GET /api/todo:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
