import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const result = await prisma.operazione.updateMany({
      where: {
        societaId,
        bozza: true,
        eliminato: false,
      },
      data: {
        bozza: false,
      },
    });

    return NextResponse.json({ confermate: result.count });
  } catch (error) {
    console.error("Errore conferma tutte le bozze:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
