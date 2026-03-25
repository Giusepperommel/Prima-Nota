import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAllChecks } from "@/lib/controlli/runner";
import type { AnomaliaTipo, AnomaliaStato, NotificaPriorita } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json().catch(() => ({}));
    const anno = body.anno ?? new Date().getFullYear();

    const result = await runAllChecks(societaId, anno);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore esecuzione controlli:", error);
    return NextResponse.json(
      { error: "Errore durante l'esecuzione dei controlli" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const stato = searchParams.get("stato") as AnomaliaStato | null;
    const tipo = searchParams.get("tipo") as AnomaliaTipo | null;
    const priorita = searchParams.get("priorita") as NotificaPriorita | null;

    const where: any = { societaId };
    if (stato) where.stato = stato;
    if (tipo) where.tipo = tipo;
    if (priorita) where.priorita = priorita;

    const anomalie = await prisma.anomalia.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json(anomalie);
  } catch (error) {
    console.error("Errore recupero anomalie:", error);
    return NextResponse.json(
      { error: "Errore durante il recupero delle anomalie" },
      { status: 500 }
    );
  }
}
