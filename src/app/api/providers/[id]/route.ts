import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;

    const config = await prisma.providerConfig.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!config) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/providers/[id] error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.providerConfig.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    const updated = await prisma.providerConfig.update({
      where: { id: Number(id) },
      data: {
        stato: body.stato,
        credenziali: body.credenziali,
        configExtra: body.configExtra,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/providers/[id] error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;

    const existing = await prisma.providerConfig.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    await prisma.providerConfig.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/providers/[id] error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
