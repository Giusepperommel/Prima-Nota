import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { movimentoId, operazioneId } = body;

    if (!movimentoId) {
      return NextResponse.json({ error: "movimentoId obbligatorio" }, { status: 400 });
    }

    // Verify movement belongs to societa
    const movimento = await prisma.movimentoBancario.findFirst({
      where: { id: movimentoId, societaId },
    });
    if (!movimento) {
      return NextResponse.json({ error: "Movimento non trovato" }, { status: 404 });
    }

    if (operazioneId) {
      // Link movement to operation
      const operazione = await prisma.operazione.findFirst({
        where: { id: operazioneId, societaId, eliminato: false },
      });
      if (!operazione) {
        return NextResponse.json({ error: "Operazione non trovata" }, { status: 404 });
      }

      await prisma.movimentoBancario.update({
        where: { id: movimentoId },
        data: {
          riconciliatoConOperazioneId: operazioneId,
          statoRiconciliazione: "RICONCILIATO",
        },
      });
    } else {
      // Unlink: remove reconciliation
      await prisma.movimentoBancario.update({
        where: { id: movimentoId },
        data: {
          riconciliatoConOperazioneId: null,
          statoRiconciliazione: "NON_RICONCILIATO",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nella riconciliazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
