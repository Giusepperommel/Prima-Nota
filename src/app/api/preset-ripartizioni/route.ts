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

    const presets = await prisma.presetRipartizione.findMany({
      where: { societaId },
      include: {
        soci: {
          include: {
            socio: {
              select: { id: true, nome: true, cognome: true, attivo: true },
            },
          },
        },
      },
      orderBy: { ordinamento: "asc" },
    });

    const serialized = presets.map((preset) => ({
      ...preset,
      soci: preset.soci.map((s) => ({
        ...s,
        percentuale: Number(s.percentuale),
      })),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero dei preset ripartizioni:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const body = await request.json();
    const { nome, tipiOperazione, soci } = body;

    // Validations
    if (!nome || !tipiOperazione || !soci) {
      return NextResponse.json(
        { error: "Nome, tipi operazione e soci sono obbligatori" },
        { status: 400 }
      );
    }

    if (!Array.isArray(tipiOperazione) || tipiOperazione.length === 0) {
      return NextResponse.json(
        { error: "Selezionare almeno un tipo operazione" },
        { status: 400 }
      );
    }

    if (!Array.isArray(soci) || soci.length === 0) {
      return NextResponse.json(
        { error: "Selezionare almeno un socio" },
        { status: 400 }
      );
    }

    // Validate percentages sum to 100
    const sommaPercentuali = soci.reduce(
      (sum: number, s: { percentuale: number }) =>
        sum + (parseFloat(String(s.percentuale)) || 0),
      0
    );
    if (Math.abs(sommaPercentuali - 100) > 0.01) {
      return NextResponse.json(
        {
          error: `La somma delle percentuali deve essere 100% (attuale: ${sommaPercentuali.toFixed(2)}%)`,
        },
        { status: 400 }
      );
    }

    // Auto-assign next ordinamento value
    const maxOrdinamento = await prisma.presetRipartizione.aggregate({
      where: { societaId },
      _max: { ordinamento: true },
    });
    const nextOrdinamento = (maxOrdinamento._max.ordinamento ?? 0) + 1;

    const preset = await prisma.presetRipartizione.create({
      data: {
        societaId,
        nome,
        tipiOperazione,
        ordinamento: nextOrdinamento,
        soci: {
          create: soci.map(
            (s: { socioId: number; percentuale: number }) => ({
              socioId: s.socioId,
              percentuale: parseFloat(String(s.percentuale)),
            })
          ),
        },
      },
      include: {
        soci: {
          include: {
            socio: {
              select: { id: true, nome: true, cognome: true, attivo: true },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        ...preset,
        soci: preset.soci.map((s) => ({
          ...s,
          percentuale: Number(s.percentuale),
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore nella creazione del preset ripartizione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
