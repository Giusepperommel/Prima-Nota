import { PrismaClient } from "@prisma/client";
import { CAUSALI_DEFAULT } from "../src/lib/contabilita/causali";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding causali contabili...");

  for (const causale of CAUSALI_DEFAULT) {
    await prisma.causaleContabile.upsert({
      where: { codice: causale.codice },
      update: {
        descrizione: causale.descrizione,
        tipoOperazione: causale.tipoOperazione,
        registroIva: causale.registroIva as any,
      },
      create: {
        codice: causale.codice,
        descrizione: causale.descrizione,
        tipoOperazione: causale.tipoOperazione,
        registroIva: causale.registroIva as any,
      },
    });
  }
  console.log(`  ${CAUSALI_DEFAULT.length} causali seeded.`);

  // 2. Map categories to PdC accounts
  console.log("Mapping categorie spesa to Piano dei Conti...");

  // Get all societa
  const societa = await prisma.societa.findMany({ select: { id: true } });

  for (const soc of societa) {
    // Get PdC for this societa
    const pdc = await prisma.pianoDeiConti.findMany({
      where: { societaId: soc.id },
      select: { id: true, codice: true, descrizione: true },
    });
    const pdcByCodice = new Map(pdc.map((p) => [p.codice, p.id]));

    // Get categories for this societa that don't have a conto mapped yet
    const categorie = await prisma.categoriaSpesa.findMany({
      where: { societaId: soc.id, contoDefaultId: null },
      select: { id: true, nome: true },
    });

    // Mapping rules: category name pattern -> PdC codice
    const MAPPING: [RegExp, string][] = [
      [/consul/i, "310.001"],
      [/inform|IT|software/i, "310.002"],
      [/marketing|comunicaz/i, "310.003"],
      [/elettric|gas|acqua|luce|energ/i, "310.010"],
      [/telefon|fisso/i, "310.013"],
      [/cellul|mobile/i, "310.014"],
      [/internet|connettiv/i, "310.015"],
      [/assicur/i, "310.020"],
      [/bancar|commissio/i, "310.030"],
      [/pubblicit|promoz/i, "310.040"],
      [/trasfer|viag|rimborso spese/i, "310.050"],
      [/rappresent|hotel|ristorant|pasti/i, "310.051"],
      [/manutenz|riparaz/i, "310.060"],
      [/canceller|materiale/i, "310.070"],
      [/abbonament.*software|SaaS/i, "310.071"],
      [/abbonament.*rivist/i, "310.072"],
      [/formaz|aggiorn/i, "310.073"],
      [/postal|corrier/i, "310.080"],
      [/affitt|locaz/i, "320.001"],
      [/noleggio.*auto/i, "320.002"],
      [/leasing/i, "320.005"],
      [/compenso.*amm|amministrat/i, "330.040"],
      [/carburant|benzina|gasolio/i, "310.050"],
    ];

    let mapped = 0;
    for (const cat of categorie) {
      for (const [pattern, codice] of MAPPING) {
        if (pattern.test(cat.nome)) {
          const pdcId = pdcByCodice.get(codice);
          if (pdcId) {
            await prisma.categoriaSpesa.update({
              where: { id: cat.id },
              data: { contoDefaultId: pdcId },
            });
            mapped++;
          }
          break;
        }
      }
    }
    console.log(
      `  Societa ${soc.id}: ${mapped}/${categorie.length} categorie mapped.`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
