import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const sezionaleId = parseInt(id, 10);

    if (isNaN(sezionaleId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const existing = await prisma.sezionaleFattura.findFirst({
      where: { id: sezionaleId, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Sezionale non trovato" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { descrizione, prefisso, separatore, tipiDocumento, paddingCifre, attivo, predefinito } = body;

    // If setting as predefinito, unset others
    if (predefinito) {
      await prisma.sezionaleFattura.updateMany({
        where: { societaId, predefinito: true, id: { not: sezionaleId } },
        data: { predefinito: false },
      });
    }

    const updated = await prisma.sezionaleFattura.update({
      where: { id: sezionaleId },
      data: {
        ...(descrizione !== undefined && { descrizione }),
        ...(prefisso !== undefined && { prefisso }),
        ...(separatore !== undefined && { separatore }),
        ...(tipiDocumento !== undefined && { tipiDocumento }),
        ...(paddingCifre !== undefined && { paddingCifre }),
        ...(attivo !== undefined && { attivo }),
        ...(predefinito !== undefined && { predefinito }),
      },
    });

    return NextResponse.json({ sezionale: updated });
  } catch (error: any) {
    console.error("Errore aggiornamento sezionale:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del sezionale" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const sezionaleId = parseInt(id, 10);

    if (isNaN(sezionaleId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    // Check for existing fatture using this sezionale
    const fattureCount = await prisma.fatturaElettronica.count({
      where: { sezionaleId, societaId },
    });

    if (fattureCount > 0) {
      return NextResponse.json(
        {
          error: `Impossibile eliminare: ${fattureCount} fatture utilizzano questo sezionale`,
        },
        { status: 409 }
      );
    }

    await prisma.sezionaleFattura.deleteMany({
      where: { id: sezionaleId, societaId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Errore eliminazione sezionale:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione del sezionale" },
      { status: 500 }
    );
  }
}
