// src/app/api/bi/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndPersistReport } from "@/lib/bi/report/generator";
import { PREDEFINED_REPORTS } from "@/lib/bi/report/templates";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const reports = await prisma.reportGeneratoBI.findMany({
      where: { societaId: user.societaId },
      orderBy: { generatoAt: "desc" },
      take: 20,
      include: { template: { select: { nome: true, tipo: true } } },
    });

    return NextResponse.json({
      reports,
      templateDisponibili: PREDEFINED_REPORTS.map((t) => ({
        tipo: t.tipo,
        nome: t.nome,
        descrizione: t.descrizione,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { tipo, anno, periodo, periodoTipo } = await request.json();
    if (!tipo) return NextResponse.json({ error: "Tipo report obbligatorio" }, { status: 400 });

    const reportId = await generateAndPersistReport(
      user.societaId,
      tipo,
      anno || new Date().getFullYear(),
      periodo || new Date().getMonth() + 1,
      periodoTipo || "MESE"
    );

    return NextResponse.json({ id: reportId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
