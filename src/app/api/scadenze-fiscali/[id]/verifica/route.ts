import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  verificaChecklist,
  aggiornaProgressoScadenza,
} from "@/lib/adempimenti/verifier";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;
    const scadenzaId = parseInt(id, 10);

    if (isNaN(scadenzaId)) {
      return NextResponse.json(
        { error: "ID scadenza non valido" },
        { status: 400 }
      );
    }

    // Fetch scadenza and verify ownership
    const scadenza = await prisma.scadenzaFiscale.findUnique({
      where: { id: scadenzaId },
      include: {
        checklist: { orderBy: { ordine: "asc" } },
      },
    });

    if (!scadenza) {
      return NextResponse.json(
        { error: "Scadenza non trovata" },
        { status: 404 }
      );
    }

    if (scadenza.societaId !== societaId) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 403 }
      );
    }

    // Verify each checklist item
    for (const item of scadenza.checklist) {
      const result = await verificaChecklist(
        societaId,
        item,
        scadenza.anno,
        scadenza.periodo ?? 0
      );

      await prisma.checklistAdempimento.update({
        where: { id: item.id },
        data: {
          completata: result.completata,
          completataAt: result.completata ? new Date() : null,
        },
      });
    }

    // Update progress
    await aggiornaProgressoScadenza(scadenzaId);

    // Return updated scadenza
    const updated = await prisma.scadenzaFiscale.findUnique({
      where: { id: scadenzaId },
      include: {
        checklist: { orderBy: { ordine: "asc" } },
      },
    });

    const serialized = {
      ...updated!,
      scadenza: updated!.scadenza.toISOString(),
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
      checklist: updated!.checklist.map((c) => ({
        ...c,
        completataAt: c.completataAt?.toISOString() ?? null,
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nella verifica scadenza:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
