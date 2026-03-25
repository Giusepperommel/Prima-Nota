import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    const statoParam = searchParams.get("stato");

    const anno = annoParam ? parseInt(annoParam, 10) : new Date().getFullYear();
    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId,
        anno,
        ...(statoParam ? { stato: statoParam as any } : {}),
      },
      include: {
        checklist: {
          orderBy: { ordine: "asc" },
        },
      },
      orderBy: { scadenza: "asc" },
    });

    const serialized = scadenze.map((s) => ({
      ...s,
      scadenza: s.scadenza.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      checklist: s.checklist.map((c) => ({
        ...c,
        completataAt: c.completataAt?.toISOString() ?? null,
      })),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero scadenze fiscali:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
