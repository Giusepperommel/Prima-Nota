import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const attive = searchParams.get("attive");

    const where: any = { societaId };
    if (attive === "true") {
      where.attiva = true;
    }

    const categorie = await prisma.categoriaSpesa.findMany({
      where,
      orderBy: [{ attiva: "desc" }, { nome: "asc" }],
    });

    // Serialize Decimal fields to numbers
    const serialized = categorie.map((cat) => ({
      ...cat,
      percentualeDeducibilita: Number(cat.percentualeDeducibilita),
      aliquotaIvaDefault: Number(cat.aliquotaIvaDefault),
      percentualeDetraibilitaIva: Number(cat.percentualeDetraibilitaIva),
      haOpzioniUso: Boolean(cat.haOpzioniUso),
      opzioniUso: cat.opzioniUso ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero delle categorie:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const societaId = user.societaId as number;
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

    // Check for duplicate name within the same societa
    const existing = await prisma.categoriaSpesa.findFirst({
      where: { societaId, nome },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Esiste gia una categoria con questo nome" },
        { status: 409 }
      );
    }

    const categoria = await prisma.categoriaSpesa.create({
      data: {
        societaId,
        nome,
        percentualeDeducibilita: percentuale,
        descrizione: descrizione || null,
        tipoCategoria: tipoCategoria || null,
        aliquotaIvaDefault: aliquotaIvaDefault !== undefined ? Number(aliquotaIvaDefault) : 22,
        percentualeDetraibilitaIva: percentualeDetraibilitaIva !== undefined ? Number(percentualeDetraibilitaIva) : 100,
      },
    });

    return NextResponse.json(
      {
        ...categoria,
        percentualeDeducibilita: Number(categoria.percentualeDeducibilita),
        aliquotaIvaDefault: Number(categoria.aliquotaIvaDefault),
        percentualeDetraibilitaIva: Number(categoria.percentualeDetraibilitaIva),
        haOpzioniUso: Boolean(categoria.haOpzioniUso),
        opzioniUso: categoria.opzioniUso ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione della categoria:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
