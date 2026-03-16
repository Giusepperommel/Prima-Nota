import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { id } = await params;
    const presetId = parseInt(id, 10);
    if (isNaN(presetId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const societaId = user.societaId as number;

    // Verify preset belongs to user's societa
    const existing = await prisma.presetRipartizione.findFirst({
      where: { id: presetId, societaId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Preset non trovato" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { nome, tipiOperazione, soci } = body;

    // If soci provided, validate sum = 100%
    if (soci !== undefined) {
      if (!Array.isArray(soci) || soci.length === 0) {
        return NextResponse.json(
          { error: "Selezionare almeno un socio" },
          { status: 400 }
        );
      }

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
    }

    // If soci provided, use transaction to delete old and recreate
    let preset;
    if (soci !== undefined) {
      preset = await prisma.$transaction(async (tx) => {
        // Delete old soci
        await tx.presetRipartizioneSocio.deleteMany({
          where: { presetRipartizioneId: presetId },
        });

        // Update preset and create new soci
        return tx.presetRipartizione.update({
          where: { id: presetId },
          data: {
            ...(nome !== undefined && { nome }),
            ...(tipiOperazione !== undefined && { tipiOperazione }),
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
                  select: {
                    id: true,
                    nome: true,
                    cognome: true,
                    attivo: true,
                  },
                },
              },
            },
          },
        });
      });
    } else {
      preset = await prisma.presetRipartizione.update({
        where: { id: presetId },
        data: {
          ...(nome !== undefined && { nome }),
          ...(tipiOperazione !== undefined && { tipiOperazione }),
        },
        include: {
          soci: {
            include: {
              socio: {
                select: {
                  id: true,
                  nome: true,
                  cognome: true,
                  attivo: true,
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({
      ...preset,
      soci: preset.soci.map((s) => ({
        ...s,
        percentuale: Number(s.percentuale),
      })),
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento del preset ripartizione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { id } = await params;
    const presetId = parseInt(id, 10);
    if (isNaN(presetId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const societaId = user.societaId as number;

    // Verify preset belongs to user's societa
    const existing = await prisma.presetRipartizione.findFirst({
      where: { id: presetId, societaId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Preset non trovato" },
        { status: 404 }
      );
    }

    // Delete preset (cascade deletes soci automatically)
    await prisma.presetRipartizione.delete({
      where: { id: presetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione del preset ripartizione:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
