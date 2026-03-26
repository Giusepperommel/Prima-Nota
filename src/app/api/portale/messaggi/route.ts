import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { sendMessage, getUnreadCount } from "@/lib/portale/messaging/message-sender";
import { hasPortalePermission } from "@/lib/portale/permissions";
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

export async function POST(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "CHAT", "scrittura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const { threadId, testo } = await request.json();
    const msgId = await sendMessage({
      threadId,
      societaId: auth.societaId,
      accessoClienteId: auth.accessoClienteId,
      mittenteTipo: "CLIENTE",
      mittenteId: auth.accessoClienteId,
      testo,
    });
    return NextResponse.json({ id: msgId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const unread = await getUnreadCount(auth.societaId, auth.accessoClienteId, "CLIENTE");
    return NextResponse.json({ nonLetti: unread });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
