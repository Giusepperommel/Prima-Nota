import type { PrismaClient } from "@prisma/client";
import { generaScritture, type MotoreInput } from "./motore-scritture";

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface GeneraScritturaDbInput {
  tx: PrismaTx;
  operazioneId: number;
  societaId: number;
  operazione: MotoreInput["operazione"];
  categoriaContoId: number | null;
  anagraficaDenominazione?: string;
  userId?: number;
  tipoDocumentoSdi?: string;
  isReverseCharge?: boolean;
  isCespite?: boolean;
  isNotaCredito?: boolean;
  isSplitPayment?: boolean;
}

export async function generaScritturaPerOperazione(
  input: GeneraScritturaDbInput
) {
  const { tx, operazioneId, societaId, userId } = input;

  // 1. Load PdC map for this societa
  const pianoDeiConti = await tx.pianoDeiConti.findMany({
    where: { societaId, attivo: true },
    select: { id: true, codice: true },
  });
  const pdcMap = new Map(pianoDeiConti.map((c) => [c.codice, c.id]));

  // 2. Generate scritture using the motore (pure functions)
  const result = generaScritture(
    {
      operazione: input.operazione,
      societaId,
      categoriaContoId: input.categoriaContoId,
      anagraficaDenominazione: input.anagraficaDenominazione,
      tipoDocumentoSdi: input.tipoDocumentoSdi,
      isReverseCharge: input.isReverseCharge,
      isCespite: input.isCespite,
      isNotaCredito: input.isNotaCredito,
      isSplitPayment: input.isSplitPayment,
    },
    pdcMap
  );

  if (result.scritture.length === 0) {
    console.warn(
      `[Scritture] Nessuna scrittura generata per operazione ${operazioneId}:`,
      result.errors
    );
    return null;
  }

  // 3. For each generated scrittura, save to DB
  const savedScritture = [];
  for (const scrittura of result.scritture) {
    const anno = input.operazione.dataOperazione.getFullYear();

    // Get next protocollo with FOR UPDATE to prevent race conditions
    const maxResult = await tx.$queryRaw<[{ max: number | null }]>`
      SELECT MAX(numero_protocollo) as max
      FROM scritture_contabili
      WHERE societa_id = ${societaId} AND anno = ${anno}
      FOR UPDATE
    `;
    const numeroProtocollo = (maxResult[0]?.max ?? 0) + 1;

    // Create ScritturaContabile
    const scritturaDb = await tx.scritturaContabile.create({
      data: {
        societaId,
        operazioneId,
        dataRegistrazione: input.operazione.dataOperazione,
        dataCompetenza: input.operazione.dataOperazione,
        numeroProtocollo,
        anno,
        descrizione: scrittura.descrizione,
        causale: scrittura.causale,
        tipoScrittura: "AUTO",
        stato: scrittura.stato,
        totaleDare: scrittura.totaleDare,
        totaleAvere: scrittura.totaleAvere,
        createdByUserId: userId ?? null,
      },
    });

    // Create MovimentiContabili
    if (scrittura.movimenti.length > 0) {
      // Filter out movimenti with null contoId (unresolved accounts)
      const validMovimenti = scrittura.movimenti.filter(
        (m) => m.contoId != null
      );

      if (validMovimenti.length > 0) {
        await tx.movimentoContabile.createMany({
          data: validMovimenti.map((m) => ({
            scritturaId: scritturaDb.id,
            societaId,
            contoId: m.contoId!,
            importoDare: m.importoDare,
            importoAvere: m.importoAvere,
            descrizione: m.descrizione ?? null,
            ordine: m.ordine,
          })),
        });
      }
    }

    savedScritture.push(scritturaDb);
  }

  return savedScritture;
}
