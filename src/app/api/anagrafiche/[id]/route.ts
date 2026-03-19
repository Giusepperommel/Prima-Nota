import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID anagrafica non valido" },
        { status: 400 }
      );
    }

    const anagrafica = await prisma.anagrafica.findFirst({
      where: { id, societaId },
    });

    if (!anagrafica) {
      return NextResponse.json(
        { error: "Anagrafica non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(anagrafica);
  } catch (error) {
    console.error("Errore nel recupero dell'anagrafica:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID anagrafica non valido" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.anagrafica.findFirst({
      where: { id, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Anagrafica non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate P.IVA if provided
    if (body.partitaIva != null && body.partitaIva !== "") {
      if (!/^\d{11}$/.test(body.partitaIva)) {
        return NextResponse.json(
          { error: "La Partita IVA deve essere di esattamente 11 cifre" },
          { status: 400 }
        );
      }
    }

    // Build update data, only including provided fields
    const updateData: Record<string, any> = {};
    const allowedFields = [
      "denominazione",
      "tipoSoggetto",
      "tipo",
      "partitaIva",
      "codiceFiscale",
      "indirizzo",
      "cap",
      "citta",
      "provincia",
      "nazione",
      "codiceDestinatario",
      "pec",
      "regimeFiscale",
      "soggettoARitenuta",
      "regimeForfettario",
      "tipoRitenuta",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await prisma.anagrafica.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Errore nell'aggiornamento dell'anagrafica:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID anagrafica non valido" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.anagrafica.findFirst({
      where: { id, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Anagrafica non trovata" },
        { status: 404 }
      );
    }

    // Check for linked operations
    const linked = await prisma.operazione.count({
      where: {
        OR: [
          { fornitoreId: id },
          { clienteId: id },
        ],
      },
    });

    if (linked > 0) {
      return NextResponse.json(
        { error: "Impossibile eliminare: anagrafica collegata a operazioni esistenti" },
        { status: 409 }
      );
    }

    await prisma.anagrafica.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione dell'anagrafica:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
