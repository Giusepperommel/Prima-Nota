/**
 * Migration script: Finanziamento → PianoPagamento
 * Run with: npx tsx prisma/scripts/migrate-finanziamento.ts
 *
 * For each existing Finanziamento record:
 * 1. Traverse Finanziamento → Veicolo → Cespite → Operazione to get operazioneId
 * 2. Create PianoPagamento with the financing parameters
 * 3. Generate Pagamento records from the installment schedule
 * 4. Deactivate linked OperazioneRicorrente
 */

import { PrismaClient } from "@prisma/client";
import { generaPianoPagamento } from "../../src/lib/calcoli-pagamenti";

const prisma = new PrismaClient();

async function main() {
  const finanziamenti = await prisma.finanziamento.findMany({
    include: {
      veicolo: {
        include: {
          cespite: {
            include: {
              operazione: { select: { id: true, societaId: true } },
            },
          },
        },
      },
      operazioneRicorrente: true,
    },
  });

  console.log(`Found ${finanziamenti.length} finanziamenti to migrate`);

  for (const fin of finanziamenti) {
    const operazioneId = fin.veicolo.cespite.operazione.id;
    const societaId = fin.veicolo.cespite.operazione.societaId;

    // Check if already migrated
    const existing = await prisma.pianoPagamento.findUnique({
      where: { operazioneId },
    });
    if (existing) {
      console.log(`  Skipping finanziamento ${fin.id} — already migrated`);
      continue;
    }

    const importoFinanziato = Number(fin.importoFinanziato);
    const numeroRate = fin.numeroRate;
    const tanVal = fin.tan ? Number(fin.tan) : 0;
    const anticipoVal = Number(fin.anticipo);
    const dataPrimaRata = fin.dataPrimaRata;

    const piano = generaPianoPagamento(importoFinanziato, numeroRate, tanVal, dataPrimaRata);

    await prisma.$transaction(async (tx) => {
      const pp = await tx.pianoPagamento.create({
        data: {
          operazioneId,
          societaId,
          tipo: "RATEALE",
          stato: "ATTIVO",
          numeroRate,
          importoRata: piano.rate.length > 0 ? piano.rate[0].importo : 0,
          tan: tanVal,
          anticipo: anticipoVal,
          dataInizio: dataPrimaRata,
        },
      });

      const pagamentiData: any[] = [];
      let numPag = 0;

      // Anticipo payment
      if (anticipoVal > 0) {
        numPag++;
        pagamentiData.push({
          pianoPagamentoId: pp.id,
          numeroPagamento: numPag,
          data: dataPrimaRata,
          importo: anticipoVal,
          quotaCapitale: anticipoVal,
          quotaInteressi: 0,
          stato: "EFFETTUATO" as const,
          dataEffettivaPagamento: dataPrimaRata,
        });
      }

      // Installment payments - mark past ones as EFFETTUATO
      const now = new Date();
      for (const rata of piano.rate) {
        numPag++;
        const isPast = rata.data < now;
        pagamentiData.push({
          pianoPagamentoId: pp.id,
          numeroPagamento: numPag,
          data: rata.data,
          importo: rata.importo,
          quotaCapitale: rata.quotaCapitale,
          quotaInteressi: rata.quotaInteressi,
          stato: isPast ? ("EFFETTUATO" as const) : ("PREVISTO" as const),
          ...(isPast ? { dataEffettivaPagamento: rata.data } : {}),
        });
      }

      await tx.pagamento.createMany({ data: pagamentiData });

      // Deactivate linked OperazioneRicorrente
      if (fin.operazioneRicorrenteId) {
        await tx.operazioneRicorrente.update({
          where: { id: fin.operazioneRicorrenteId },
          data: { attiva: false },
        });
      }

      console.log(`  Migrated finanziamento ${fin.id} → PianoPagamento ${pp.id} (${numPag} pagamenti)`);
    });
  }

  console.log("Migration complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
