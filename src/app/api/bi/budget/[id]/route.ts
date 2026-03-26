// src/app/api/bi/budget/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compareBudgetVsActual } from "@/lib/bi/comparativa/budget";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const mese = parseInt(searchParams.get("mese") || String(new Date().getMonth() + 1));

    const budget = await prisma.budget.findFirst({
      where: { id: parseInt(id), societaId: user.societaId },
      include: { righe: { include: { conto: { select: { descrizione: true } } } } },
    });

    if (!budget) return NextResponse.json({ error: "Budget non trovato" }, { status: 404 });

    const comparison = await compareBudgetVsActual(user.societaId, budget.id, mese);

    return NextResponse.json({ budget, comparison });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
