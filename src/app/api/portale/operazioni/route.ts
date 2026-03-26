import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { createPortalOperation } from "@/lib/portale/operations/operation-handler";
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

    const operazioni = await prisma.operazionePortale.findMany({
      where: { accessoClienteId: auth.accessoClienteId, societaId: auth.societaId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ operazioni });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "PRIMA_NOTA", "scrittura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const { tipo, dati, documentoAllegato } = await request.json();

    const opId = await createPortalOperation({
      societaId: auth.societaId,
      accessoClienteId: auth.accessoClienteId,
      tipo,
      dati,
      documentoAllegato,
    });

    return NextResponse.json({ id: opId, stato: "BOZZA" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
