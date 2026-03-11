import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaCessione } from "@/lib/calcoli-veicoli";
import { calcolaRipartizione } from "@/lib/business-utils";
import { logAttivita } from "@/lib/log-helper";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { id } = await context.params;
    const cespiteId = parseInt(id, 10);

    if (isNaN(cespiteId)) {
      return NextResponse.json(
        { error: "ID cespite non valido" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { dataCessione, prezzoVendita } = body;

    if (!dataCessione || prezzoVendita == null) {
      return NextResponse.json(
        { error: "Data cessione e prezzo vendita sono obbligatori" },
        { status: 400 },
      );
    }

    const prezzo = parseFloat(String(prezzoVendita));
    if (isNaN(prezzo) || prezzo < 0) {
      return NextResponse.json(
        { error: "Il prezzo di vendita deve essere un valore valido" },
        { status: 400 },
      );
    }

    // Fetch cespite with vehicle data
    const cespite = await prisma.cespite.findFirst({
      where: { id: cespiteId, societaId },
      include: {
        veicolo: true,
        operazione: {
          include: {
            ripartizioni: {
              include: {
                socio: { select: { id: true, quotaPercentuale: true } },
              },
            },
          },
        },
        quoteAmmortamento: { orderBy: { anno: "asc" } },
      },
    });

    if (!cespite) {
      return NextResponse.json(
        { error: "Cespite non trovato" },
        { status: 404 },
      );
    }

    if (cespite.stato === "CEDUTO") {
      return NextResponse.json(
        { error: "Cespite gia ceduto" },
        { status: 400 },
      );
    }

    if (!cespite.veicolo) {
      return NextResponse.json(
        { error: "Il cespite non e un veicolo" },
        { status: 400 },
      );
    }

    // Calculate plusvalenza/minusvalenza
    const percentualeDeducibilita = Number(
      cespite.veicolo.percentualeDeducibilita,
    );
    const costoStorico = Number(cespite.valoreIniziale);

    // Recalculate fondo up to cessione year
    const annoCessione = new Date(dataCessione).getFullYear();
    let fondoAllaCessione = 0;
    for (const q of cespite.quoteAmmortamento) {
      if (q.anno <= annoCessione) {
        fondoAllaCessione += Number(q.importoQuota);
      }
    }
    fondoAllaCessione = Math.round(fondoAllaCessione * 100) / 100;

    const risultato = calcolaCessione(
      prezzo,
      costoStorico,
      fondoAllaCessione,
      percentualeDeducibilita,
    );

    // Get ripartizione info from original operation for the sale operation
    const soci = cespite.operazione.ripartizioni.map((r) => ({
      id: r.socio.id,
      quotaPercentuale: Number(r.socio.quotaPercentuale),
    }));

    const tipoRip = cespite.operazione.tipoRipartizione as
      | "COMUNE"
      | "SINGOLO"
      | "CUSTOM";
    const socioSingoloId =
      tipoRip === "SINGOLO"
        ? cespite.operazione.ripartizioni.find(
            (r) => Number(r.percentuale) === 100,
          )?.socioId
        : undefined;

    const ripartizioniCalc = calcolaRipartizione(
      prezzo,
      tipoRip,
      soci,
      socioSingoloId,
    );

    const result = await prisma.$transaction(async (tx) => {
      // Update cespite stato to CEDUTO
      await tx.cespite.update({
        where: { id: cespiteId },
        data: {
          stato: "CEDUTO",
          fondoAmmortamento: fondoAllaCessione,
        },
      });

      // Remove future depreciation quotas (after cessione year)
      await tx.quotaAmmortamento.deleteMany({
        where: {
          cespiteId,
          anno: { gt: annoCessione },
        },
      });

      // Create CessioneVeicolo
      const cessione = await tx.cessioneVeicolo.create({
        data: {
          veicoloId: cespite.veicolo!.id,
          dataCessione: new Date(dataCessione),
          prezzoVendita: prezzo,
          valoreResiduoContabile: risultato.valoreResiduoContabile,
          plusvalenza: risultato.plusvalenza,
          plusvalenzaImponibile: risultato.plusvalenzaImponibile,
          minusvalenza: risultato.minusvalenza,
          minusvalenzaDeducibile: risultato.minusvalenzaDeducibile,
        },
      });

      // Create ENTRATA operation for the sale proceeds (if price > 0)
      let operazioneVendita = null;
      if (prezzo > 0) {
        operazioneVendita = await tx.operazione.create({
          data: {
            societaId,
            tipoOperazione: "FATTURA_ATTIVA",
            dataOperazione: new Date(dataCessione),
            descrizione: `Cessione veicolo ${cespite.veicolo!.marca} ${cespite.veicolo!.modello} ${cespite.veicolo!.targa}`,
            importoTotale: prezzo,
            categoriaId: cespite.operazione.categoriaId,
            importoDeducibile: 0,
            percentualeDeducibilita: 0,
            tipoRipartizione: cespite.operazione.tipoRipartizione as any,
            createdByUserId: userId,
            note: `Plusvalenza: ${risultato.plusvalenza} (imponibile: ${risultato.plusvalenzaImponibile}) | Minusvalenza: ${risultato.minusvalenza} (deducibile: ${risultato.minusvalenzaDeducibile})`,
          },
        });

        await tx.ripartizioneOperazione.createMany({
          data: ripartizioniCalc.map((rip) => ({
            operazioneId: operazioneVendita!.id,
            socioId: rip.socioId,
            percentuale: rip.percentuale,
            importoCalcolato: rip.importo,
          })),
        });
      }

      // Deactivate financing recurring operation if exists
      const finanziamento = await tx.finanziamento.findUnique({
        where: { veicoloId: cespite.veicolo!.id },
      });
      if (finanziamento?.operazioneRicorrenteId) {
        await tx.operazioneRicorrente.update({
          where: { id: finanziamento.operazioneRicorrenteId },
          data: { attiva: false },
        });
      }

      return { cessione, operazioneVendita };
    });

    await logAttivita({
      userId,
      azione: "UPDATE",
      tabella: "cespiti",
      recordId: cespiteId,
      valoriDopo: {
        stato: "CEDUTO",
        dataCessione,
        prezzoVendita: prezzo,
        ...risultato,
      },
    });

    return NextResponse.json({
      ...risultato,
      cespiteId,
      operazioneVenditaId: result.operazioneVendita?.id || null,
    });
  } catch (error) {
    console.error("Errore nella cessione del veicolo:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
