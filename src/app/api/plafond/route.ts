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
    const annoParam = searchParams.get("anno");

    if (!annoParam) {
      return NextResponse.json(
        { error: "Parametro anno obbligatorio" },
        { status: 400 }
      );
    }

    const anno = parseInt(annoParam, 10);
    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const plafond = await prisma.plafond.findUnique({
      where: {
        societaId_anno: { societaId, anno },
      },
    });

    if (!plafond) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        id: plafond.id,
        anno: plafond.anno,
        metodo: plafond.metodo,
        importoDisponibile: Number(plafond.importoDisponibile),
        importoUtilizzato: Number(plafond.importoUtilizzato),
      },
    });
  } catch (error) {
    console.error("Errore nel recupero plafond:", error);
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
    const societaId = user.societaId as number;

    const body = await request.json();
    const { anno, metodo, importoDisponibile } = body;

    if (!anno || typeof anno !== "number") {
      return NextResponse.json(
        { error: "Parametro anno obbligatorio (numero)" },
        { status: 400 }
      );
    }

    if (!metodo || !["FISSO", "MOBILE"].includes(metodo)) {
      return NextResponse.json(
        { error: "Parametro metodo obbligatorio (FISSO o MOBILE)" },
        { status: 400 }
      );
    }

    if (importoDisponibile == null || typeof importoDisponibile !== "number" || importoDisponibile < 0) {
      return NextResponse.json(
        { error: "Parametro importoDisponibile obbligatorio (numero >= 0)" },
        { status: 400 }
      );
    }

    const plafond = await prisma.plafond.upsert({
      where: {
        societaId_anno: { societaId, anno },
      },
      update: {
        metodo,
        importoDisponibile,
      },
      create: {
        societaId,
        anno,
        metodo,
        importoDisponibile,
        importoUtilizzato: 0,
      },
    });

    return NextResponse.json({
      data: {
        id: plafond.id,
        anno: plafond.anno,
        metodo: plafond.metodo,
        importoDisponibile: Number(plafond.importoDisponibile),
        importoUtilizzato: Number(plafond.importoUtilizzato),
      },
    });
  } catch (error) {
    console.error("Errore nel salvataggio plafond:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
