import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PERMISSIONS } from "@/lib/portale/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accessoClienteId = parseInt(searchParams.get("clienteId") || "0");
    if (!accessoClienteId) return NextResponse.json({ error: "clienteId obbligatorio" }, { status: 400 });

    const permessi = await prisma.permessoPortale.findMany({
      where: { accessoClienteId },
    });

    return NextResponse.json({
      permessi: permessi.length > 0 ? permessi : DEFAULT_PERMISSIONS.map((p) => ({ ...p, accessoClienteId })),
      sezioniDisponibili: DEFAULT_PERMISSIONS.map((p) => p.sezione),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { accessoClienteId, permessi } = await request.json();
    if (!accessoClienteId || !Array.isArray(permessi)) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    // Upsert all permissions
    for (const p of permessi) {
      await prisma.permessoPortale.upsert({
        where: { accessoClienteId_sezione: { accessoClienteId, sezione: p.sezione } },
        update: { lettura: p.lettura, scrittura: p.scrittura },
        create: { accessoClienteId, sezione: p.sezione, lettura: p.lettura, scrittura: p.scrittura },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
