import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PIANO_DEI_CONTI_DEFAULT } from "@/lib/piano-dei-conti-default";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    // Check if conti already exist for this società
    const existingCount = await prisma.pianoDeiConti.count({
      where: { societaId },
    });

    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Il piano dei conti è già stato inizializzato per questa società" },
        { status: 409 }
      );
    }

    // Seed all default accounts
    await prisma.pianoDeiConti.createMany({
      data: PIANO_DEI_CONTI_DEFAULT.map((conto) => ({
        societaId,
        codice: conto.codice,
        descrizione: conto.descrizione,
        tipo: conto.tipo,
        voceSp: conto.voceSp,
        voceCe: conto.voceCe,
        naturaSaldo: conto.naturaSaldo,
        attivo: true,
        preConfigurato: true,
        modificabile: false,
      })),
    });

    return NextResponse.json(
      { message: "Piano dei conti inizializzato con successo", count: PIANO_DEI_CONTI_DEFAULT.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nell'inizializzazione del piano dei conti:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
