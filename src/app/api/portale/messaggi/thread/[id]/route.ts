import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { markMessagesAsRead } from "@/lib/portale/messaging/message-sender";
import type { PortaleTokenPayload } from "@/lib/portale/types";

async function getPortaleAuth(req: NextRequest): Promise<PortaleTokenPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await verifyPortaleToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const { id } = await params;

    const thread = await prisma.threadPortale.findFirst({
      where: { id: parseInt(id), accessoClienteId: auth.accessoClienteId },
      include: {
        messaggi: { orderBy: { createdAt: "asc" }, include: { allegati: true } },
      },
    });

    if (!thread) return NextResponse.json({ error: "Thread non trovato" }, { status: 404 });

    // Mark as read
    await markMessagesAsRead(thread.id, "CLIENTE");

    return NextResponse.json({ thread });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
