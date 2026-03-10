import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { id } = await params;
    const categoriaId = parseInt(id, 10);
    if (isNaN(categoriaId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const societaId = user.societaId as number;

    // Verify that the category belongs to the user's societa
    const existing = await prisma.categoriaSpesa.findFirst({
      where: { id: categoriaId, societaId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Categoria non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { nome, percentualeDeducibilita, descrizione, tipoCategoria, aliquotaIvaDefault, percentualeDetraibilitaIva } = body;

    if (!nome || percentualeDeducibilita === undefined || percentualeDeducibilita === null) {
      return NextResponse.json(
        { error: "Nome e percentuale di deducibilita sono obbligatori" },
        { status: 400 }
      );
    }

    const percentuale = Number(percentualeDeducibilita);
    if (isNaN(percentuale) || percentuale < 0 || percentuale > 100) {
      return NextResponse.json(
        { error: "La percentuale di deducibilita deve essere compresa tra 0 e 100" },
        { status: 400 }
      );
    }

    // Check for duplicate name (excluding self)
    const duplicate = await prisma.categoriaSpesa.findFirst({
      where: { societaId, nome, id: { not: categoriaId } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Esiste gia una categoria con questo nome" },
        { status: 409 }
      );
    }

    const updated = await prisma.categoriaSpesa.update({
      where: { id: categoriaId },
      data: {
        nome,
        percentualeDeducibilita: percentuale,
        descrizione: descrizione || null,
        tipoCategoria: tipoCategoria || null,
        aliquotaIvaDefault: aliquotaIvaDefault !== undefined ? Number(aliquotaIvaDefault) : undefined,
        percentualeDetraibilitaIva: percentualeDetraibilitaIva !== undefined ? Number(percentualeDetraibilitaIva) : undefined,
      },
    });

    return NextResponse.json({
      ...updated,
      percentualeDeducibilita: Number(updated.percentualeDeducibilita),
      aliquotaIvaDefault: Number(updated.aliquotaIvaDefault),
      percentualeDetraibilitaIva: Number(updated.percentualeDetraibilitaIva),
      haOpzioniUso: Boolean(updated.haOpzioniUso),
      opzioniUso: updated.opzioniUso ?? null,
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento della categoria:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { id } = await params;
    const categoriaId = parseInt(id, 10);
    if (isNaN(categoriaId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const societaId = user.societaId as number;

    // Verify ownership and get current state
    const existing = await prisma.categoriaSpesa.findFirst({
      where: { id: categoriaId, societaId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Categoria non trovata" },
        { status: 404 }
      );
    }

    const updated = await prisma.categoriaSpesa.update({
      where: { id: categoriaId },
      data: { attiva: !existing.attiva },
    });

    return NextResponse.json({
      ...updated,
      percentualeDeducibilita: Number(updated.percentualeDeducibilita),
      aliquotaIvaDefault: Number(updated.aliquotaIvaDefault),
      percentualeDetraibilitaIva: Number(updated.percentualeDetraibilitaIva),
      haOpzioniUso: Boolean(updated.haOpzioniUso),
      opzioniUso: updated.opzioniUso ?? null,
    });
  } catch (error) {
    console.error("Errore nel toggle della categoria:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
