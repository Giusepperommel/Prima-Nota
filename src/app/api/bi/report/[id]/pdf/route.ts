// src/app/api/bi/report/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderReportToPdf } from "@/lib/bi/report/pdf-renderer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const report = await prisma.reportGeneratoBI.findFirst({
      where: { id: parseInt(id), societaId: user.societaId },
      include: {
        template: { select: { nome: true } },
      },
    });

    if (!report) return NextResponse.json({ error: "Report non trovato" }, { status: 404 });

    const societa = await prisma.societa.findUnique({
      where: { id: user.societaId },
      select: { ragioneSociale: true },
    });

    const pdfBuffer = await renderReportToPdf(
      report.dati as any,
      societa?.ragioneSociale || "Società"
    );

    const filename = `${report.template.nome.replace(/\s+/g, "_")}_${report.periodo}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
