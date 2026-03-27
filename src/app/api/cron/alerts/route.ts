import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { generateAlerts } from "@/lib/intelligence/alert-engine/evaluator";
import { sendEmail } from "@/lib/email/send-email";
import { formatAlertEmailSubject, formatAlertEmailHtml } from "@/lib/email/alert-email";

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

        // Send email notifications for CRITICAL alerts created in the last hour
        const criticalAlerts = await prisma.alertGenerato.findMany({
          where: {
            societaId: s.id,
            gravita: "CRITICAL",
            stato: "NUOVO",
            createdAt: { gte: new Date(Date.now() - 3600000) },
          },
          include: {
            utente: { select: { email: true } },
            regola: { select: { canali: true } },
          },
        });

        for (const alert of criticalAlerts) {
          const canali = (alert.regola.canali as string[]) || [];
          if (canali.includes("EMAIL") && alert.utente.email) {
            await sendEmail({
              to: alert.utente.email,
              subject: formatAlertEmailSubject(alert.gravita, alert.messaggio),
              html: formatAlertEmailHtml({
                messaggio: alert.messaggio,
                gravita: alert.gravita,
                categoria: alert.tipo,
                linkAzione: alert.linkAzione || undefined,
                societaNome: s.ragioneSociale,
              }),
            });
          }
        }
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
