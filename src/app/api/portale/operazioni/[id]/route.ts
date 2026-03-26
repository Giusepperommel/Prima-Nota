import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validatePortalOperation } from "@/lib/portale/operations/operation-handler";
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
    // Support both portal JWT and main session
    const portaleAuth = await getPortaleAuth(request);
    const { id } = await params;
    const opId = parseInt(id);

    const where: any = { id: opId };
    if (portaleAuth) where.accessoClienteId = portaleAuth.accessoClienteId;

    const op = await prisma.operazionePortale.findFirst({ where });
    if (!op) return NextResponse.json({ error: "Operazione non trovata" }, { status: 404 });

    return NextResponse.json({ operazione: op });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only commercialista (main auth) can validate
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { id } = await params;
    const { azione, note } = await request.json();

    if (!["VALIDATA", "RIFIUTATA"].includes(azione)) {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    await validatePortalOperation(parseInt(id), azione, note);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
