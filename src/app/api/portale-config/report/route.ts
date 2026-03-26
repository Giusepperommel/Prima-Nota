import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReport } from "@/lib/portale/report-generator";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await request.json();

    const { tipo, periodo, data } = body;

    if (!tipo || !periodo) {
      return NextResponse.json(
        { error: "tipo e periodo sono obbligatori" },
        { status: 400 }
      );
    }

    // Get societa name for the report
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { ragioneSociale: true },
    });

    const reportData = {
      ...data,
      societaNome: societa?.ragioneSociale,
      periodo,
    };

    const { contenuto } = await generateReport(tipo, reportData);

    const report = await prisma.reportCliente.create({
      data: {
        societaId,
        tipo,
        periodo,
        contenutoGenerato: contenuto,
        stato: "GENERATO",
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Errore generazione report:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await request.json();

    const { id, contenutoApprovato } = body;

    if (!id || !contenutoApprovato) {
      return NextResponse.json(
        { error: "id e contenutoApprovato sono obbligatori" },
        { status: 400 }
      );
    }

    // Verify report belongs to this societa
    const existing = await prisma.reportCliente.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Report non trovato" },
        { status: 404 }
      );
    }

    const report = await prisma.reportCliente.update({
      where: { id: Number(id) },
      data: {
        contenutoApprovato,
        stato: "APPROVATO",
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Errore approvazione report:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
