import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { createThread, listThreads } from "@/lib/portale/messaging/thread-manager";
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

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "CHAT", "lettura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const threads = await listThreads(auth.societaId, auth.accessoClienteId);
    return NextResponse.json({ threads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "CHAT", "scrittura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const { oggetto, testo, contestoTipo, contestoId } = await request.json();
    const result = await createThread({
      societaId: auth.societaId,
      accessoClienteId: auth.accessoClienteId,
      oggetto,
      testoIniziale: testo,
      contestoTipo,
      contestoId,
      mittenteTipo: "CLIENTE",
      mittenteId: auth.accessoClienteId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
