import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await req.json();

    const minConfidence = body.minConfidence ?? 0.9;

    // Find all bozze with confidence >= threshold
    const bozze = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: true,
        sorgente: { in: ["XML_IMPORT", "OCR", "BANCA"] },
        aiConfidence: { gte: minConfidence },
      },
      select: { id: true },
    });

    if (bozze.length === 0) {
      return NextResponse.json({ confermate: 0, saltate: 0, ids: [] });
    }

    const ids = bozze.map((b) => b.id);

    await prisma.operazione.updateMany({
      where: { id: { in: ids } },
      data: { bozza: false },
    });

    return NextResponse.json({
      confermate: ids.length,
      saltate: 0,
      ids,
    });
  } catch (error) {
    console.error("POST /api/import/conferma-batch error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
