import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLipeData } from "@/lib/lipe/builder";
import { generateLipeXml, generateLipeFileName, getScadenzaInvioLipe } from "@/lib/lipe/generator";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { anno, trimestre } = body;

    if (!anno || !trimestre || trimestre < 1 || trimestre > 4) {
      return NextResponse.json(
        { error: "Parametri anno e trimestre (1-4) obbligatori" },
        { status: 400 }
      );
    }

    // Build LIPE data from liquidazioni
    const lipeData = await buildLipeData(societaId, anno, trimestre);

    if (lipeData.comunicazione.datiContabili.length === 0) {
      return NextResponse.json(
        { error: "Nessuna liquidazione trovata per il trimestre selezionato. Calcolare prima le liquidazioni." },
        { status: 400 }
      );
    }

    // Generate XML
    const xmlContent = generateLipeXml(lipeData);

    // Determine progressivo
    const societa = await prisma.societa.findUniqueOrThrow({
      where: { id: societaId },
      select: { codiceFiscale: true },
    });

    const existingCount = await prisma.lipeInvio.count({
      where: { societaId },
    });
    const progressivo = existingCount + 1;

    const nomeFile = generateLipeFileName(societa.codiceFiscale, progressivo);
    const scadenzaInvio = getScadenzaInvioLipe(anno, trimestre);

    // Upsert LipeInvio record
    const lipeInvio = await prisma.lipeInvio.upsert({
      where: {
        societaId_anno_trimestre: {
          societaId,
          anno,
          trimestre,
        },
      },
      create: {
        societaId,
        anno,
        trimestre,
        xmlContent,
        nomeFile,
        progressivoFile: String(progressivo).padStart(5, "0"),
        stato: "GENERATA",
        scadenzaInvio,
      },
      update: {
        xmlContent,
        nomeFile,
        progressivoFile: String(progressivo).padStart(5, "0"),
        stato: "GENERATA",
        dataGenerazione: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        id: lipeInvio.id,
        nomeFile: lipeInvio.nomeFile,
        stato: lipeInvio.stato,
        dataGenerazione: lipeInvio.dataGenerazione.toISOString(),
        scadenzaInvio: lipeInvio.scadenzaInvio.toISOString(),
        trimestre: lipeInvio.trimestre,
        anno: lipeInvio.anno,
      },
    });
  } catch (error) {
    console.error("Errore nella generazione LIPE:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
