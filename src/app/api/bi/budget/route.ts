// src/app/api/bi/budget/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const budgets = await prisma.budget.findMany({
      where: { societaId: user.societaId },
      orderBy: { anno: "desc" },
    });

    return NextResponse.json({ budgets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { anno, nome, righe } = await request.json();
    if (!anno || !nome) return NextResponse.json({ error: "Anno e nome obbligatori" }, { status: 400 });

    const budget = await prisma.budget.create({
      data: {
        societaId: user.societaId,
        anno,
        nome,
        righe: righe
          ? {
              create: righe.map((r: any) => ({
                contoId: r.contoId,
                mese: r.mese,
                importo: r.importo,
              })),
            }
          : undefined,
      },
      include: { righe: true },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
