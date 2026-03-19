import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID operazione non valido" },
        { status: 400 }
      );
    }

    // Verify operation exists and belongs to user's societa
    const operazione = await prisma.operazione.findFirst({
      where: { id, societaId: user.societaId, eliminato: false },
    });
    if (!operazione) {
      return NextResponse.json(
        { error: "Operazione non trovata" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update data - only include fields that are present in body
    const updateData: any = {};

    const optionalFields = [
      "fornitoreId",
      "clienteId",
      "dataCompetenzaInizio",
      "dataCompetenzaFine",
      "statoPagamentoFattura",
      "dataPagamento",
      "importoPagato",
      "codiceContoId",
      "naturaOperazioneIva",
      "tipoDocumentoSdi",
      "protocolloIva",
      "registroIva",
      "dataRegistrazione",
      "splitPayment",
      "soggettoARitenuta",
      "importoRitenuta",
      "importoNettoRitenuta",
      "bolloVirtuale",
      "importoBollo",
      "rateoRiscontoId",
    ];

    for (const field of optionalFields) {
      if (body[field] !== undefined) {
        // Convert date strings to Date objects
        if (
          [
            "dataCompetenzaInizio",
            "dataCompetenzaFine",
            "dataPagamento",
            "dataRegistrazione",
          ].includes(field) &&
          body[field]
        ) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Handle ritenuta upsert/delete in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update operazione
      const updated = await tx.operazione.update({
        where: { id },
        data: updateData,
      });

      // If soggettoARitenuta is explicitly set
      if (body.soggettoARitenuta === true && body.ritenuta) {
        // Upsert ritenuta record
        const ritData = body.ritenuta;
        const existing = await tx.ritenuta.findUnique({
          where: { operazioneId: id },
        });

        const ritFields = {
          societaId: user.societaId,
          operazioneId: id,
          anagraficaId:
            ritData.anagraficaId ||
            body.fornitoreId ||
            operazione.fornitoreId,
          tipoRitenuta: ritData.tipoRitenuta,
          aliquota: ritData.aliquota,
          percentualeImponibile: ritData.percentualeImponibile,
          importoLordo: ritData.importoLordo,
          baseImponibile: ritData.baseImponibile,
          importoRitenuta: ritData.importoRitenuta,
          importoNetto: ritData.importoNetto,
          rivalsaInps: ritData.rivalsaInps ?? null,
          cassaPrevidenza: ritData.cassaPrevidenza ?? null,
          meseCompetenza: ritData.meseCompetenza,
          annoCompetenza: ritData.annoCompetenza,
          codiceTributo: ritData.codiceTributo,
        };

        if (existing) {
          await tx.ritenuta.update({
            where: { operazioneId: id },
            data: ritFields,
          });
        } else {
          await tx.ritenuta.create({ data: ritFields });
        }
      } else if (body.soggettoARitenuta === false) {
        // Delete existing ritenuta if any
        await tx.ritenuta.deleteMany({
          where: { operazioneId: id },
        });
      }

      return updated;
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error("Errore nell'aggiornamento dati contabili:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
