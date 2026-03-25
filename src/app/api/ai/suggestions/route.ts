import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { searchParams } = new URL(req.url);
    const stato = searchParams.get("stato") ?? "PENDING";
    const limit = Number(searchParams.get("limit") ?? 20);

    const suggestions = await prisma.aiSuggestion.findMany({
      where: { societaId, stato: stato as any },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const serialized = suggestions.map((s) => ({
      ...s,
      confidence: Number(s.confidence),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("GET /api/ai/suggestions error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const societaId = user.societaId as number;
    const body = await req.json();

    const { id, action } = body;

    if (!id || !["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json(
        { error: "id e action (APPROVED|REJECTED) sono obbligatori" },
        { status: 400 },
      );
    }

    const suggestion = await prisma.aiSuggestion.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion non trovata" }, { status: 404 });
    }

    const updated = await prisma.aiSuggestion.update({
      where: { id: Number(id) },
      data: {
        stato: action,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      confidence: Number(updated.confidence),
    });
  } catch (error) {
    console.error("PUT /api/ai/suggestions error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
