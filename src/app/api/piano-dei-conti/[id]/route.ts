import { NextRequest, NextResponse } from "next/server";
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
    const { id } = await context.params;
    const contoId = parseInt(id, 10);

    if (isNaN(contoId)) {
      return NextResponse.json(
        { error: "ID conto non valido" },
        { status: 400 }
      );
    }

    const conto = await prisma.pianoDeiConti.findFirst({
      where: { id: contoId, societaId },
    });

    if (!conto) {
      return NextResponse.json(
        { error: "Conto non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(conto);
  } catch (error) {
    console.error("Errore nel recupero del conto:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const isCommercialista = user.modalitaCommercialista === true;
    const { id } = await context.params;
    const contoId = parseInt(id, 10);

    if (isNaN(contoId)) {
      return NextResponse.json(
        { error: "ID conto non valido" },
        { status: 400 }
      );
    }

    const conto = await prisma.pianoDeiConti.findFirst({
      where: { id: contoId, societaId },
    });

    if (!conto) {
      return NextResponse.json(
        { error: "Conto non trovato" },
        { status: 404 }
      );
    }

    // Only commercialista or conti with modificabile=true can be updated
    if (!isCommercialista && !conto.modificabile) {
      return NextResponse.json(
        { error: "Non hai i permessi per modificare questo conto" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.descrizione !== undefined) updateData.descrizione = body.descrizione;
    if (body.voceSp !== undefined) updateData.voceSp = body.voceSp;
    if (body.voceCe !== undefined) updateData.voceCe = body.voceCe;
    if (body.attivo !== undefined) updateData.attivo = body.attivo;

    const updated = await prisma.pianoDeiConti.update({
      where: { id: contoId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Errore nell'aggiornamento del conto:", error);
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
    const isCommercialista = user.modalitaCommercialista === true;

    if (!isCommercialista) {
      return NextResponse.json(
        { error: "Solo la modalità commercialista può eliminare conti" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const contoId = parseInt(id, 10);

    if (isNaN(contoId)) {
      return NextResponse.json(
        { error: "ID conto non valido" },
        { status: 400 }
      );
    }

    const conto = await prisma.pianoDeiConti.findFirst({
      where: { id: contoId, societaId },
    });

    if (!conto) {
      return NextResponse.json(
        { error: "Conto non trovato" },
        { status: 404 }
      );
    }

    // Check if conto has linked operazioni
    const operazioniCount = await prisma.operazione.count({
      where: { codiceContoId: contoId },
    });

    if (operazioniCount > 0) {
      return NextResponse.json(
        { error: `Impossibile eliminare: il conto è collegato a ${operazioniCount} operazione/i` },
        { status: 409 }
      );
    }

    await prisma.pianoDeiConti.delete({
      where: { id: contoId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione del conto:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
