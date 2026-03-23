import { PrismaClient } from "@prisma/client";
import { generaScritturaPerOperazione } from "../src/lib/contabilita/db-scrittura";

const prisma = new PrismaClient();

async function main() {
  const societa = await prisma.societa.findMany({ select: { id: true } });

  let totalGenerated = 0;
  let totalProvvisorie = 0;
  let totalErrors = 0;

  for (const soc of societa) {
    console.log(`\nProcessing societa ${soc.id}...`);

    const operazioni = await prisma.operazione.findMany({
      where: { societaId: soc.id, eliminato: false },
      include: {
        categoria: { select: { id: true, contoDefaultId: true } },
      },
      orderBy: { dataOperazione: "asc" },
    });

    // Check if scritture already exist
    const existingCount = await prisma.scritturaContabile.count({
      where: { societaId: soc.id },
    });

    if (existingCount > 0) {
      console.log(`  Skipping: ${existingCount} scritture already exist.`);
      continue;
    }

    for (const op of operazioni) {
      try {
        // Use a transaction for each operation
        await prisma.$transaction(async (tx) => {
          await generaScritturaPerOperazione({
            tx: tx as any,
            operazioneId: op.id,
            societaId: soc.id,
            operazione: {
              tipoOperazione: op.tipoOperazione,
              dataOperazione: op.dataOperazione,
              descrizione: op.descrizione,
              importoTotale: Number(op.importoTotale),
              importoImponibile: op.importoImponibile
                ? Number(op.importoImponibile)
                : undefined,
              importoIva: op.importoIva ? Number(op.importoIva) : undefined,
              aliquotaIva: op.aliquotaIva
                ? Number(op.aliquotaIva)
                : undefined,
              ivaDetraibile: op.ivaDetraibile
                ? Number(op.ivaDetraibile)
                : undefined,
              ivaIndetraibile: op.ivaIndetraibile
                ? Number(op.ivaIndetraibile)
                : undefined,
              splitPayment: op.splitPayment || false,
              importoRitenuta: op.importoRitenuta
                ? Number(op.importoRitenuta)
                : undefined,
              importoNettoRitenuta: op.importoNettoRitenuta
                ? Number(op.importoNettoRitenuta)
                : undefined,
              bolloVirtuale: op.bolloVirtuale || false,
              importoBollo: op.importoBollo
                ? Number(op.importoBollo)
                : undefined,
              doppiaRegistrazione: op.doppiaRegistrazione || false,
              numeroDocumento: op.numeroDocumento || undefined,
              statoPagamentoFattura: op.statoPagamentoFattura || undefined,
            },
            categoriaContoId: op.categoria?.contoDefaultId ?? null,
            isCespite: op.tipoOperazione === "CESPITE",
            isReverseCharge: op.doppiaRegistrazione || false,
            isSplitPayment: op.splitPayment || false,
            tipoDocumentoSdi: op.tipoDocumentoSdi || undefined,
          });
          totalGenerated++;
        });
      } catch (err) {
        totalErrors++;
        console.error(
          `  Error on operazione ${op.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Count provvisorie
    const provv = await prisma.scritturaContabile.count({
      where: { societaId: soc.id, stato: "PROVVISORIA" },
    });
    totalProvvisorie += provv;
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Generated: ${totalGenerated}`);
  console.log(`Provvisorie: ${totalProvvisorie}`);
  console.log(`Errors: ${totalErrors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
