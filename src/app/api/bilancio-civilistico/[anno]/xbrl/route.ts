import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateXbrl } from "@/lib/bilancio/xbrl-generator";
import type { BilancioCompleto, StatoPatrimoniale, ContoEconomico } from "@/lib/bilancio/types";

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

    // Load societa data for XBRL
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { partitaIva: true, ragioneSociale: true },
    });

    if (!societa) {
      return NextResponse.json({ error: "Societa non trovata" }, { status: 404 });
    }

    // Reconstruct BilancioCompleto from stored data
    const bilancioCompleto: BilancioCompleto = {
      anno: bilancio.anno,
      tipo: bilancio.tipo as "ORDINARIO" | "ABBREVIATO",
      statoPatrimoniale: bilancio.datiSp as unknown as StatoPatrimoniale,
      contoEconomico: bilancio.datiCe as unknown as ContoEconomico,
      totaleAttivo: Number(bilancio.totaleAttivo),
      totalePassivo: Number(bilancio.totalePassivo),
      utileEsercizio: Number(bilancio.utileEsercizio),
    };

    const xbrl = generateXbrl(bilancioCompleto, {
      partitaIva: societa.partitaIva,
      ragioneSociale: societa.ragioneSociale,
    });

    return new NextResponse(xbrl, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="bilancio_${anno}.xbrl"`,
      },
    });
  } catch (error) {
    console.error("[bilancio-civilistico/anno/xbrl]", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
