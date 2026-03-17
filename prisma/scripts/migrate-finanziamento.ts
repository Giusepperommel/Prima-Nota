/**
 * Migration script: Finanziamento → PianoPagamento
 * Run with: npx tsx prisma/scripts/migrate-finanziamento.ts
 *
 * Uses raw SQL to read from finanziamenti table (model already removed from schema)
 * and Prisma client to write PianoPagamento + Pagamento records.
 */

import { PrismaClient } from "@prisma/client";
import { generaPianoPagamento } from "../../src/lib/calcoli-pagamenti";

type FinanziamentoRow = {
  id: number;
  importo_finanziato: number; // Decimal comes as number in raw
  anticipo: number;
  numero_rate: number;
  tan: number | null;
  data_prima_rata: Date;
  operazione_ricorrente_id: number | null;
  operazione_id: number;
  societa_id: number;
};

const prisma = new PrismaClient();

async function main() {
  // Raw SQL join: finanziamenti → veicoli → cespiti → operazioni
  const finanziamenti = await prisma.$queryRaw<FinanziamentoRow[]>`
    SELECT
      f.id,
      f.importo_finanziato,
      f.anticipo,
      f.numero_rate,
      f.tan,
      f.data_prima_rata,
      f.operazione_ricorrente_id,
      o.id AS operazione_id,
      o.societa_id
    FROM finanziamenti f
    JOIN veicoli v ON v.id = f.veicolo_id
    JOIN cespiti c ON c.id = v.cespite_id
    JOIN operazioni o ON o.id = c.operazione_id
  `;

  console.log(`Found ${finanziamenti.length} finanziamenti to migrate`);

  for (const fin of finanziamenti) {
    const operazioneId = fin.operazione_id;
    const societaId = fin.societa_id;

    // Check if already migrated
    const existing = await prisma.pianoPagamento.findUnique({
      where: { operazioneId },
    });
    if (existing) {
      console.log(`  Skipping finanziamento ${fin.id} — already migrated`);
      continue;
    }

    const importoFinanziato = Number(fin.importo_finanziato);
    const numeroRate = fin.numero_rate;
    const tanVal = fin.tan ? Number(fin.tan) : 0;
    const anticipoVal = Number(fin.anticipo);
    const dataPrimaRata = new Date(fin.data_prima_rata);

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
      if (fin.operazione_ricorrente_id) {
        await tx.operazioneRicorrente.update({
          where: { id: fin.operazione_ricorrente_id },
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
