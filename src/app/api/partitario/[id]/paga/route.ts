import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;
    const scadenzaId = parseInt(id, 10);

    if (isNaN(scadenzaId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const body = await request.json();
    const { importoPagamento } = body;

    if (importoPagamento === undefined || importoPagamento <= 0) {
      return NextResponse.json({ error: "Importo pagamento non valido" }, { status: 400 });
    }

    const scadenza = await prisma.scadenzaPartitario.findFirst({
      where: { id: scadenzaId, societaId },
    });

    if (!scadenza) {
      return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 });
    }

    if (scadenza.stato === "CHIUSA") {
      return NextResponse.json({ error: "Scadenza gia chiusa" }, { status: 400 });
    }

    const importoCorrente = Number(scadenza.importoPagato);
    const importoTotale = Number(scadenza.importo);
    const nuovoImportoPagato = Math.min(
      Math.round((importoCorrente + importoPagamento) * 100) / 100,
      importoTotale,
    );

    const nuovoStato =
      nuovoImportoPagato >= importoTotale
        ? "CHIUSA"
        : nuovoImportoPagato > 0
          ? "PARZIALE"
          : "APERTA";

    const updated = await prisma.scadenzaPartitario.update({
      where: { id: scadenzaId },
      data: {
        importoPagato: nuovoImportoPagato,
        stato: nuovoStato,
      },
    });

    return NextResponse.json({
      id: updated.id,
      importoPagato: Number(updated.importoPagato),
      stato: updated.stato,
      residuo: Math.round((importoTotale - nuovoImportoPagato) * 100) / 100,
    });
  } catch (error) {
    console.error("Errore nel pagamento della scadenza:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
