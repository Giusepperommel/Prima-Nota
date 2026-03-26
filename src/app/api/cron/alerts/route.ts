import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { generateAlerts } from "@/lib/intelligence/alert-engine/evaluator";

export async function POST(request: NextRequest) {
  const authError = authenticateCron(request);
  if (authError) return authError;

  try {
    const societa = await prisma.societa.findMany({
      select: { id: true, ragioneSociale: true },
    });

    const results: { societaId: number; nome: string; alertCreati: number; errore?: string }[] = [];

    for (const s of societa) {
      try {
        const count = await generateAlerts(s.id);
        results.push({ societaId: s.id, nome: s.ragioneSociale, alertCreati: count });
      } catch (error: any) {
        results.push({ societaId: s.id, nome: s.ragioneSociale, alertCreati: 0, errore: error.message });
      }
    }

    const totale = results.reduce((sum, r) => sum + r.alertCreati, 0);
    console.log(`[Cron:Alerts] Generati ${totale} alert per ${societa.length} società`);

    return NextResponse.json({ success: true, totaleAlert: totale, dettagli: results });
  } catch (error: any) {
    console.error("[Cron:Alerts] Errore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
