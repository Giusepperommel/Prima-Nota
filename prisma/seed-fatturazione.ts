/**
 * Seed default sezionali and provider configuration for all societa.
 *
 * Run with: npx tsx prisma/seed-fatturazione.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SEZIONALI = [
  {
    codice: "FT",
    descrizione: "Fatture",
    prefisso: "FT",
    separatore: "/",
    tipiDocumento: ["TD01", "TD24"],
    predefinito: true,
    paddingCifre: 1,
  },
  {
    codice: "NC",
    descrizione: "Note di credito",
    prefisso: "NC",
    separatore: "/",
    tipiDocumento: ["TD04"],
    predefinito: false,
    paddingCifre: 1,
  },
  {
    codice: "ND",
    descrizione: "Note di debito",
    prefisso: "ND",
    separatore: "/",
    tipiDocumento: ["TD05"],
    predefinito: false,
    paddingCifre: 1,
  },
];

async function main() {
  const societa = await prisma.societa.findMany({
    select: { id: true, ragioneSociale: true },
  });

  const currentYear = new Date().getFullYear();

  for (const s of societa) {
    console.log(`Configurazione fatturazione per: ${s.ragioneSociale} (id: ${s.id})`);

    // Create default sezionali if none exist
    const existingSezionali = await prisma.sezionaleFattura.count({
      where: { societaId: s.id },
    });

    if (existingSezionali === 0) {
      for (const sez of DEFAULT_SEZIONALI) {
        await prisma.sezionaleFattura.create({
          data: {
            societaId: s.id,
            codice: sez.codice,
            descrizione: sez.descrizione,
            prefisso: sez.prefisso,
            separatore: sez.separatore,
            tipiDocumento: sez.tipiDocumento,
            predefinito: sez.predefinito,
            paddingCifre: sez.paddingCifre,
            annoCorrente: currentYear,
          },
        });
      }
      console.log(`  + ${DEFAULT_SEZIONALI.length} sezionali creati`);
    } else {
      console.log(`  = ${existingSezionali} sezionali gia presenti, skip`);
    }

    // Create default provider configuration if none exists
    const existingProvider = await prisma.configurazioneProviderFe.findUnique({
      where: { societaId: s.id },
    });

    if (!existingProvider) {
      await prisma.configurazioneProviderFe.create({
        data: {
          societaId: s.id,
          provider: "MANUALE",
          attivo: true,
        },
      });
      console.log("  + Configurazione provider MANUALE creata");
    } else {
      console.log(`  = Provider ${existingProvider.provider} gia presente, skip`);
    }
  }

  console.log("\nSeed fatturazione completato.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
