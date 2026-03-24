import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const lipeInvio = await prisma.lipeInvio.findUnique({
      where: { id },
    });

    if (!lipeInvio || lipeInvio.societaId !== societaId) {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download");

    if (download === "true") {
      // Return XML file for download
      return new NextResponse(lipeInvio.xmlContent, {
        status: 200,
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="${lipeInvio.nomeFile}"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        id: lipeInvio.id,
        anno: lipeInvio.anno,
        trimestre: lipeInvio.trimestre,
        nomeFile: lipeInvio.nomeFile,
        stato: lipeInvio.stato,
        dataGenerazione: lipeInvio.dataGenerazione.toISOString(),
        dataInvio: lipeInvio.dataInvio?.toISOString() ?? null,
        scadenzaInvio: lipeInvio.scadenzaInvio.toISOString(),
        xmlContent: lipeInvio.xmlContent,
      },
    });
  } catch (error) {
    console.error("Errore nel recupero LIPE:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: update LIPE status (mark as sent).
 */
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
    const societaId = user.societaId as number;

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const lipeInvio = await prisma.lipeInvio.findUnique({
      where: { id },
    });

    if (!lipeInvio || lipeInvio.societaId !== societaId) {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }

    const body = await request.json();
    const { stato, dataInvio } = body;

    if (stato && !["BOZZA", "GENERATA", "INVIATA"].includes(stato)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }

    const updated = await prisma.lipeInvio.update({
      where: { id },
      data: {
        ...(stato && { stato }),
        ...(dataInvio && { dataInvio: new Date(dataInvio) }),
        ...(stato === "INVIATA" && !dataInvio && { dataInvio: new Date() }),
      },
    });

    // Also update the related liquidazioni lipeInviata flag
    if (stato === "INVIATA") {
      const periodoCondition =
        lipeInvio.trimestre === 1
          ? { periodo: { gte: 1, lte: 3 } }
          : lipeInvio.trimestre === 2
            ? { periodo: { gte: 4, lte: 6 } }
            : lipeInvio.trimestre === 3
              ? { periodo: { gte: 7, lte: 9 } }
              : { periodo: { gte: 10, lte: 12 } };

      await prisma.liquidazioneIva.updateMany({
        where: {
          societaId,
          anno: lipeInvio.anno,
          ...periodoCondition,
        },
        data: {
          lipeInviata: true,
          lipeDataInvio: new Date(),
        },
      });
    }

    return NextResponse.json({
      data: {
        id: updated.id,
        stato: updated.stato,
        dataInvio: updated.dataInvio?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento LIPE:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
