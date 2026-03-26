import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { hasPortalePermission } from "@/lib/portale/permissions";
import type { PortaleTokenPayload } from "@/lib/portale/types";

async function getPortaleAuth(req: NextRequest): Promise<PortaleTokenPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await verifyPortaleToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "KPI", "lettura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;

    // Health Score
    const healthScore = await prisma.healthScore.findFirst({
      where: { societaId: auth.societaId, anno, mese },
      orderBy: { calcolatoAt: "desc" },
    });

    // KPI values (latest cached)
    const kpis = await prisma.kpiValore.findMany({
      where: { societaId: auth.societaId, periodoTipo: "MESE" },
      orderBy: { calcolatoAt: "desc" },
      include: { kpi: { select: { codice: true, nome: true, categoria: true } } },
      distinct: ["kpiId"],
    });

    // Next 5 deadlines
    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: auth.societaId,
        scadenza: { gte: now },
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE", "PRONTA"] },
      },
      orderBy: { scadenza: "asc" },
      take: 5,
    });

    // Active alerts
    const alerts = await prisma.alertGenerato.findMany({
      where: { societaId: auth.societaId, stato: { in: ["NUOVO", "VISTO"] } },
      orderBy: [{ gravita: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    return NextResponse.json({
      healthScore,
      kpis: kpis.map((k) => ({
        codice: k.kpi.codice,
        nome: k.kpi.nome,
        categoria: k.kpi.categoria,
        valore: k.valore,
        variazione: k.variazione,
        trend: k.trend,
      })),
      scadenze,
      alerts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
