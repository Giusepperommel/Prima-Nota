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

    const { providerConfigId } = body;

    const config = await prisma.providerConfig.findFirst({
      where: { id: providerConfigId, societaId },
    });

    if (!config) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    // For FILE providers, test is always successful
    if (config.provider === "FILE") {
      await prisma.providerConfig.update({
        where: { id: config.id },
        data: { stato: "ATTIVO" },
      });

      return NextResponse.json({ success: true, messaggio: "Provider file attivo" });
    }

    // For API providers (future): attempt connection test
    return NextResponse.json(
      { success: false, messaggio: `Test per ${config.provider} non ancora implementato` },
      { status: 501 },
    );
  } catch (error) {
    console.error("POST /api/providers/test error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
