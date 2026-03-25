import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const providers = await prisma.providerConfig.findMany({
      where: { societaId },
      orderBy: { tipo: "asc" },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error("GET /api/providers error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await req.json();

    const { tipo, provider, configExtra } = body;

    if (!tipo || !provider) {
      return NextResponse.json(
        { error: "tipo e provider sono obbligatori" },
        { status: 400 },
      );
    }

    const config = await prisma.providerConfig.create({
      data: {
        societaId,
        tipo,
        provider,
        stato: provider === "FILE" ? "ATTIVO" : "CONFIGURAZIONE",
        configExtra: configExtra ?? undefined,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Provider già configurato per questa società" },
        { status: 409 },
      );
    }
    console.error("POST /api/providers error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
