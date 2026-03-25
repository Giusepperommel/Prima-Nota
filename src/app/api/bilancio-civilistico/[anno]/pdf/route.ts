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
      return NextResponse.json(
        { error: "Bilancio non ancora generato per questo anno. Generare prima il bilancio." },
        { status: 404 }
      );
    }

    // Placeholder: in futuro generare PDF effettivo con React-PDF o puppeteer
    return NextResponse.json({
      message: "Generazione PDF non ancora implementata. Utilizzare l'export XBRL.",
      anno: bilancio.anno,
      tipo: bilancio.tipo,
      dataGenerazione: bilancio.dataGenerazione,
      totaleAttivo: Number(bilancio.totaleAttivo),
      totalePassivo: Number(bilancio.totalePassivo),
      utileEsercizio: Number(bilancio.utileEsercizio),
      _placeholder: true,
    });
  } catch (error) {
    console.error("[bilancio-civilistico/anno/pdf]", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
