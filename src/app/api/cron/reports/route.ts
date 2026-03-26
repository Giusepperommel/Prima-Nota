import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { generateAndPersistReport } from "@/lib/bi/report/generator";

function shouldGenerateToday(schedulazione: string | null): boolean {
  if (!schedulazione) return false;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  const dayOfMonth = now.getDate();

  switch (schedulazione) {
    case "SETTIMANALE":
      return dayOfWeek === 1; // Monday
    case "MENSILE":
      return dayOfMonth === 1; // First of month
    case "TRIMESTRALE":
      return dayOfMonth === 1 && [0, 3, 6, 9].includes(now.getMonth()); // Jan, Apr, Jul, Oct
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  const authError = authenticateCron(request);
  if (authError) return authError;

  try {
    const templates = await prisma.reportTemplate.findMany({
      where: { attivo: true, schedulazione: { not: null } },
      include: { societa: { select: { id: true } } },
    });

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;
    let generated = 0;

    for (const template of templates) {
      if (!shouldGenerateToday(template.schedulazione)) continue;
      if (!template.societa) continue;

      const periodoTipo = template.schedulazione === "TRIMESTRALE" ? "TRIMESTRE" :
                          template.schedulazione === "MENSILE" ? "MESE" : "MESE";
      const periodo = periodoTipo === "TRIMESTRE" ? Math.ceil(mese / 3) : mese;

      try {
        await generateAndPersistReport(template.societa.id, template.tipo, anno, periodo, periodoTipo);
        generated++;
      } catch (error) {
        console.error(`[Cron:Reports] Errore template ${template.id}:`, error);
      }
    }

    console.log(`[Cron:Reports] Generati ${generated} report`);

    return NextResponse.json({ success: true, reportGenerati: generated });
  } catch (error: any) {
    console.error("[Cron:Reports] Errore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
