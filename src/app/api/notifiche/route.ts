import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationEngine } from "@/lib/notifiche/engine";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const { searchParams } = new URL(req.url);
    const stato = searchParams.get("stato");
    const limit = Number(searchParams.get("limit") ?? 20);

    const notifiche = await prisma.notifica.findMany({
      where: {
        utenteDestinatarioId: userId,
        ...(stato ? { stato: stato as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const nonLette = await prisma.notifica.count({
      where: { utenteDestinatarioId: userId, stato: "NON_LETTA" },
    });

    return NextResponse.json({ notifiche, nonLette });
  } catch (error) {
    console.error("GET /api/notifiche error:", error);
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
    const body = await req.json();

    const engine = new NotificationEngine();

    if (body.action === "markAsRead" && body.id) {
      await engine.markAsRead(body.id, userId);
    } else if (body.action === "markAllAsRead" && body.societaId) {
      await engine.markAllAsRead(userId, body.societaId);
    } else {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/notifiche error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
