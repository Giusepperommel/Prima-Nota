// src/lib/bi/report/generator.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { calculateAllKpis } from "../kpi/engine";
import { comparePeriods } from "../comparativa/periodo";
import { getReportTemplate } from "./templates";
import type { ReportSectionDef } from "./types";

export interface GeneratedReportData {
  sezioni: { titolo: string; tipo: string; dati: unknown }[];
  periodo: string;
  generatoAt: string;
}

async function resolveSection(
  section: ReportSectionDef,
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<{ titolo: string; tipo: string; dati: unknown }> {
  switch (section.tipo) {
    case "kpi_summary": {
      const kpis = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
      const categoria = (section.config?.categoria as string) || null;
      const codici = (section.config?.codici as string[]) || null;
      let filtered = kpis;
      if (categoria) filtered = filtered.filter((k) => k.categoria === categoria);
      if (codici) filtered = filtered.filter((k) => codici.includes(k.codice));
      return { titolo: section.titolo, tipo: section.tipo, dati: filtered };
    }
    case "kpi_table": {
      const kpis = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
      const codici = (section.config?.codici as string[]) || [];
      return { titolo: section.titolo, tipo: section.tipo, dati: kpis.filter((k) => codici.includes(k.codice)) };
    }
    case "comparison": {
      const pt = (section.config?.periodoTipo as string) || periodoTipo;
      const result = await comparePeriods(societaId, anno, periodo, pt);
      return { titolo: section.titolo, tipo: section.tipo, dati: result };
    }
    case "health_score": {
      const hs = await prisma.healthScore.findFirst({
        where: { societaId, anno, mese: periodo },
        orderBy: { calcolatoAt: "desc" },
      });
      return { titolo: section.titolo, tipo: section.tipo, dati: hs };
    }
    case "alert_summary": {
      const alerts = await prisma.alertGenerato.findMany({
        where: { societaId, stato: { in: ["NUOVO", "VISTO"] } },
        orderBy: { gravita: "desc" },
        take: 10,
      });
      return { titolo: section.titolo, tipo: section.tipo, dati: alerts };
    }
    case "text":
    default:
      return { titolo: section.titolo, tipo: section.tipo, dati: null };
  }
}

export async function generateReport(
  societaId: number,
  reportTipo: string,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<GeneratedReportData> {
  const template = getReportTemplate(reportTipo);
  if (!template) throw new Error(`Template report non trovato: ${reportTipo}`);

  const sezioni = [];
  for (const section of template.sezioni) {
    const resolved = await resolveSection(section, societaId, anno, periodo, periodoTipo);
    sezioni.push(resolved);
  }

  return {
    sezioni,
    periodo: `${anno}-${String(periodo).padStart(2, "0")}`,
    generatoAt: new Date().toISOString(),
  };
}

export async function generateAndPersistReport(
  societaId: number,
  reportTipo: string,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<number> {
  const template = getReportTemplate(reportTipo);
  if (!template) throw new Error(`Template report non trovato: ${reportTipo}`);

  // Find or create DB template
  let dbTemplate = await prisma.reportTemplate.findFirst({
    where: { tipo: reportTipo, OR: [{ societaId }, { societaId: null }] },
  });

  if (!dbTemplate) {
    dbTemplate = await prisma.reportTemplate.create({
      data: {
        nome: template.nome,
        tipo: template.tipo,
        sezioni: template.sezioni as unknown as Prisma.InputJsonValue,
        destinatari: template.destinatariDefault,
      },
    });
  }

  const data = await generateReport(societaId, reportTipo, anno, periodo, periodoTipo);

  const report = await prisma.reportGeneratoBI.create({
    data: {
      societaId,
      templateId: dbTemplate.id,
      periodo: data.periodo,
      dati: data as unknown as Prisma.InputJsonValue,
      stato: "GENERATO",
    },
  });

  return report.id;
}
