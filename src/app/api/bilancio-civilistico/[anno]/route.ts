import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ anno: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { anno: annoStr } = await params;
    const anno = parseInt(annoStr);

    if (isNaN(anno)) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const bilancio = await prisma.bilancioGenerato.findUnique({
      where: {
        societaId_anno: { societaId, anno },
      },
    });

    if (!bilancio) {
      return NextResponse.json({ bilancio: null });
    }

    return NextResponse.json({
      id: bilancio.id,
      anno: bilancio.anno,
      tipo: bilancio.tipo,
      dataGenerazione: bilancio.dataGenerazione,
      statoPatrimoniale: bilancio.datiSp,
      contoEconomico: bilancio.datiCe,
      totaleAttivo: Number(bilancio.totaleAttivo),
      totalePassivo: Number(bilancio.totalePassivo),
      utileEsercizio: Number(bilancio.utileEsercizio),
    });
  } catch (error) {
    console.error("[bilancio-civilistico/anno]", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
