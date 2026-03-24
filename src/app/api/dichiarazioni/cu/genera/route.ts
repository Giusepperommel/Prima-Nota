import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generaCU, validaCU } from "@/lib/dichiarazioni/cu";
import { TIPO_RITENUTA_TO_CAUSALE } from "@/lib/dichiarazioni/cu/cu-types";
import type { RitenutaInput } from "@/lib/dichiarazioni/cu";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;

    const body = await request.json();
    const { anno } = body;

    if (!anno) {
      return NextResponse.json({ error: "anno obbligatorio" }, { status: 400 });
    }

    // 1. Fetch all ritenute for the year with anagrafica data
    const ritenute = await prisma.ritenuta.findMany({
      where: {
        societaId: user.societaId,
        annoCompetenza: anno,
      },
      include: {
        anagrafica: {
          select: {
            id: true,
            denominazione: true,
            codiceFiscale: true,
            partitaIva: true,
            indirizzo: true,
            cap: true,
            citta: true,
            provincia: true,
          },
        },
      },
    });

    // Convert to engine input type
    const ritenuteInput: RitenutaInput[] = ritenute.map((r) => ({
      id: r.id,
      anagraficaId: r.anagraficaId,
      tipoRitenuta: r.tipoRitenuta,
      importoLordo: Number(r.importoLordo),
      baseImponibile: Number(r.baseImponibile),
      importoRitenuta: Number(r.importoRitenuta),
      rivalsaInps: r.rivalsaInps ? Number(r.rivalsaInps) : null,
      cassaPrevidenza: r.cassaPrevidenza ? Number(r.cassaPrevidenza) : null,
      meseCompetenza: r.meseCompetenza,
      annoCompetenza: r.annoCompetenza,
      codiceTributo: r.codiceTributo,
      dataVersamento: r.dataVersamento,
      statoVersamento: r.statoVersamento,
      anagrafica: r.anagrafica,
    }));

    // 2. Validate
    const warnings = validaCU(ritenuteInput, anno);

    // 3. Generate CU data
    const cuData = generaCU(ritenuteInput, anno);

    if (cuData.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Nessuna ritenuta trovata per l'anno specificato",
        warnings,
      }, { status: 404 });
    }

    // 4. Upsert CertificazioneUnica records
    const results = [];
    for (const cu of cuData) {
      const upserted = await prisma.certificazioneUnica.upsert({
        where: {
          societaId_anno_anagraficaId: {
            societaId: user.societaId,
            anno,
            anagraficaId: cu.anagraficaId,
          },
        },
        update: {
          causaleCu: cu.causaleCu,
          ammontareLordo: cu.ammontareLordo,
          imponibile: cu.imponibile,
          ritenutaAcconto: cu.ritenutaAcconto,
          rivalsaInps: cu.rivalsaInps,
          cassaPrevidenza: cu.cassaPrevidenza,
          stato: "GENERATA",
          dataGenerazione: new Date(),
        },
        create: {
          societaId: user.societaId,
          anno,
          anagraficaId: cu.anagraficaId,
          causaleCu: cu.causaleCu,
          ammontareLordo: cu.ammontareLordo,
          imponibile: cu.imponibile,
          ritenutaAcconto: cu.ritenutaAcconto,
          rivalsaInps: cu.rivalsaInps,
          cassaPrevidenza: cu.cassaPrevidenza,
          stato: "GENERATA",
          dataGenerazione: new Date(),
        },
      });

      results.push({
        ...upserted,
        ammontareLordo: Number(upserted.ammontareLordo),
        imponibile: Number(upserted.imponibile),
        ritenutaAcconto: Number(upserted.ritenutaAcconto),
        rivalsaInps: Number(upserted.rivalsaInps),
        cassaPrevidenza: Number(upserted.cassaPrevidenza),
        percipiente: cu.denominazione,
      });
    }

    // 5. Mark ritenute as CU emessa
    await prisma.ritenuta.updateMany({
      where: {
        societaId: user.societaId,
        annoCompetenza: anno,
      },
      data: {
        cuEmessa: true,
        cuDataEmissione: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      anno,
      totalePercipienti: results.length,
      certificazioni: results,
      warnings,
    });
  } catch (error) {
    console.error("Errore nella generazione CU:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
