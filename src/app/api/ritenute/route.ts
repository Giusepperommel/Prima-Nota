import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const stato = searchParams.get("stato");
    const anno = searchParams.get("anno");

    const ritenute = await prisma.ritenuta.findMany({
      where: {
        societaId: user.societaId,
        ...(stato ? { statoVersamento: stato as any } : {}),
        ...(anno ? { annoCompetenza: parseInt(anno, 10) } : {}),
      },
      include: {
        operazione: {
          select: {
            id: true,
            descrizione: true,
            dataOperazione: true,
            importoTotale: true,
          },
        },
        anagrafica: {
          select: { id: true, denominazione: true },
        },
      },
      orderBy: [{ annoCompetenza: "desc" }, { meseCompetenza: "desc" }],
    });

    // Serialize Decimals
    const serialized = ritenute.map((r) => ({
      ...r,
      aliquota: Number(r.aliquota),
      percentualeImponibile: Number(r.percentualeImponibile),
      importoLordo: Number(r.importoLordo),
      baseImponibile: Number(r.baseImponibile),
      importoRitenuta: Number(r.importoRitenuta),
      importoNetto: Number(r.importoNetto),
      rivalsaInps: r.rivalsaInps ? Number(r.rivalsaInps) : null,
      cassaPrevidenza: r.cassaPrevidenza ? Number(r.cassaPrevidenza) : null,
      importoVersato: r.importoVersato ? Number(r.importoVersato) : null,
      operazione: {
        ...r.operazione,
        importoTotale: Number(r.operazione.importoTotale),
      },
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero delle ritenute:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
