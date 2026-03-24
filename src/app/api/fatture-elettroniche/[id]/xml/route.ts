import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const fatturaId = parseInt(id, 10);

    if (isNaN(fatturaId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const fattura = await prisma.fatturaElettronica.findFirst({
      where: {
        id: fatturaId,
        societaId,
      },
      select: {
        xmlContent: true,
        nomeFile: true,
      },
    });

    if (!fattura) {
      return NextResponse.json(
        { error: "Fattura non trovata" },
        { status: 404 }
      );
    }

    return new NextResponse(fattura.xmlContent, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fattura.nomeFile}"`,
      },
    });
  } catch (error: any) {
    console.error("Errore download XML:", error);
    return NextResponse.json(
      { error: "Errore nel download del file XML" },
      { status: 500 }
    );
  }
}
