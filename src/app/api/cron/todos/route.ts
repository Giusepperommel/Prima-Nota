import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { persistTodosForUser } from "@/lib/intelligence/todo-engine/generator";

export async function POST(request: NextRequest) {
  const authError = authenticateCron(request);
  if (authError) return authError;

  try {
    // Get all active users with their company
    const utentiAzienda = await prisma.utenteAzienda.findMany({
      where: { attivo: true },
      select: { utenteId: true, societaId: true },
    });

    let totalCreated = 0;
    let errors = 0;

    for (const ua of utentiAzienda) {
      try {
        await persistTodosForUser(ua.societaId, ua.utenteId);
        totalCreated++;
      } catch (error) {
        errors++;
        console.error(`[Cron:Todos] Errore per utente ${ua.utenteId}:`, error);
      }
    }

    console.log(`[Cron:Todos] Processati ${totalCreated} utenti, ${errors} errori`);

    return NextResponse.json({ success: true, utentiProcessati: totalCreated, errori: errors });
  } catch (error: any) {
    console.error("[Cron:Todos] Errore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
