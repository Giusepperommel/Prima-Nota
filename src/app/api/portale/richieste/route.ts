import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
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
    if (!auth) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const richieste = await prisma.richiestaDocumento.findMany({
      where: {
        accessoClienteId: auth.accessoClienteId,
        stato: { in: ["INVIATA", "VISTA"] },
      },
      include: {
        domande: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(richieste);
  } catch (error) {
    console.error("Errore richieste portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
