import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generaScritturaPerOperazione } from "@/lib/contabilita/db-scrittura";
import type { SessionUser } from "@/types";

type RouteContext = { params: Promise<{ operazioneId: string }> };

/**
 * POST /api/scritture-contabili/rigenera/[operazioneId]
 *
 * Regenerates the scrittura contabile for a given operazione.
 * Deletes existing scritture and movimenti, then re-runs the generator.
 *
 * Only available for modalita_commercialista users.
 */
export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const societaId = user.societaId;

  if (!societaId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!user.modalitaCommercialista) {
    return NextResponse.json(
      { error: "Funzione riservata alla modalita commercialista" },
      { status: 403 },
    );
  }

  const { operazioneId: operazioneIdStr } = await context.params;
  const operazioneId = parseInt(operazioneIdStr, 10);
  if (isNaN(operazioneId)) {
    return NextResponse.json({ error: "ID operazione non valido" }, { status: 400 });
  }

  // Find the operazione
  const operazione = await prisma.operazione.findFirst({
    where: { id: operazioneId, societaId, eliminato: false },
    include: {
      categoria: { select: { id: true, contoDefaultId: true } },
      fornitore: { select: { id: true, denominazione: true } },
      cliente: { select: { id: true, denominazione: true } },
    },
  });

  if (!operazione) {
    return NextResponse.json({ error: "Operazione non trovata" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing scritture (cascade deletes movimenti via onDelete: Cascade)
      await tx.scritturaContabile.deleteMany({
        where: { operazioneId },
      });

      // Determine anagrafica denomination
      const anagraficaDenominazione =
        operazione.fornitore?.denominazione ??
        operazione.cliente?.denominazione ??
        undefined;

      // Determine context flags
      const isReverseCharge =
        operazione.tipoDocumentoSdi === "TD16" ||
        operazione.tipoDocumentoSdi === "TD17" ||
        operazione.tipoDocumentoSdi === "TD18" ||
        operazione.tipoDocumentoSdi === "TD19" ||
        Boolean(operazione.doppiaRegistrazione);

      const isCespite = operazione.tipoOperazione === "CESPITE";
      const isSplitPayment = Boolean(operazione.splitPayment);

      // Regenerate
      const scritture = await generaScritturaPerOperazione({
        tx,
        operazioneId,
        societaId,
        operazione: {
          tipoOperazione: operazione.tipoOperazione,
          dataOperazione: operazione.dataOperazione,
          descrizione: operazione.descrizione,
          importoTotale: Number(operazione.importoTotale),
          importoImponibile: operazione.importoImponibile != null ? Number(operazione.importoImponibile) : undefined,
          importoIva: operazione.importoIva != null ? Number(operazione.importoIva) : undefined,
          aliquotaIva: operazione.aliquotaIva != null ? Number(operazione.aliquotaIva) : undefined,
          ivaDetraibile: operazione.ivaDetraibile != null ? Number(operazione.ivaDetraibile) : undefined,
          ivaIndetraibile: operazione.ivaIndetraibile != null ? Number(operazione.ivaIndetraibile) : undefined,
          importoRitenuta: operazione.importoRitenuta != null ? Number(operazione.importoRitenuta) : undefined,
          importoNettoRitenuta: operazione.importoNettoRitenuta != null ? Number(operazione.importoNettoRitenuta) : undefined,
          numeroDocumento: operazione.numeroDocumento ?? undefined,
          splitPayment: isSplitPayment,
          bolloVirtuale: Boolean(operazione.bolloVirtuale),
          importoBollo: operazione.importoBollo != null ? Number(operazione.importoBollo) : undefined,
        },
        categoriaContoId: operazione.categoria?.contoDefaultId ?? null,
        anagraficaDenominazione,
        userId: user.id,
        tipoDocumentoSdi: operazione.tipoDocumentoSdi ?? undefined,
        isReverseCharge,
        isCespite,
        isNotaCredito: false,
        isSplitPayment,
      });

      return scritture;
    });

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: "Nessuna scrittura generata per questa operazione" },
        { status: 422 },
      );
    }

    // Reload the created scritture with movimenti for the response
    const scrittureIds = result.map((s) => s.id);
    const scrittureComplete = await prisma.scritturaContabile.findMany({
      where: { id: { in: scrittureIds } },
      include: {
        movimenti: {
          include: { conto: { select: { codice: true, descrizione: true } } },
          orderBy: { ordine: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      success: true,
      scritture: scrittureComplete.map((s) => ({
        ...s,
        totaleDare: Number(s.totaleDare),
        totaleAvere: Number(s.totaleAvere),
        movimenti: s.movimenti.map((m) => ({
          ...m,
          importoDare: Number(m.importoDare),
          importoAvere: Number(m.importoAvere),
        })),
      })),
    });
  } catch (error: unknown) {
    console.error("Errore rigenerazione scrittura:", error);
    return NextResponse.json(
      { error: "Errore nella rigenerazione della scrittura" },
      { status: 500 },
    );
  }
}
