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

    const bozze = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: true,
        eliminato: false,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        operazioneRicorrente: {
          select: { id: true, tipoContratto: true },
        },
      },
      orderBy: { dataOperazione: "asc" },
    });

    const serialized = bozze.map((op) => ({
      id: op.id,
      dataOperazione: op.dataOperazione.toISOString(),
      descrizione: op.descrizione,
      importoTotale: Number(op.importoTotale),
      categoria: op.categoria,
      tipoOperazione: op.tipoOperazione,
      operazioneRicorrenteId: op.operazioneRicorrenteId,
      tipoContratto: op.operazioneRicorrente?.tipoContratto ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore GET bozze:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
