import { PrismaClient, RuoloUtente, RuoloAzienda } from "@prisma/client";

const prisma = new PrismaClient();

function mapRuolo(ruoloSocio: RuoloUtente): { ruoloAzienda: RuoloAzienda; isSuperAdmin: boolean } {
  switch (ruoloSocio) {
    case "SUPER_ADMIN":
      return { ruoloAzienda: RuoloAzienda.ADMIN, isSuperAdmin: true };
    case "ADMIN":
      return { ruoloAzienda: RuoloAzienda.ADMIN, isSuperAdmin: false };
    case "STANDARD":
    default:
      return { ruoloAzienda: RuoloAzienda.STANDARD, isSuperAdmin: false };
  }
}

async function main() {
  console.log("=== Migrazione Multi-Azienda ===\n");

  // 1. Find all Utente records that have a Socio (via socioId)
  const utenti = await prisma.utente.findMany({
    include: { socio: true },
  });

  let utentiProcessed = 0;
  let utenteAziendaCreated = 0;
  let logsUpdated = 0;

  for (const utente of utenti) {
    const socio = utente.socio;
    if (!socio) continue;

    // a. Copy nome/cognome from Socio to Utente
    // b. Set Socio.utenteId = Utente.id
    const { ruoloAzienda, isSuperAdmin } = mapRuolo(socio.ruolo);

    await prisma.utente.update({
      where: { id: utente.id },
      data: {
        nome: socio.nome,
        cognome: socio.cognome,
        isSuperAdmin,
      },
    });

    // b. Set Socio.utenteId
    await prisma.socio.update({
      where: { id: socio.id },
      data: { utenteId: utente.id },
    });

    utentiProcessed++;

    // c. Create UtenteAzienda if Socio has societaId
    if (socio.societaId != null) {
      await prisma.utenteAzienda.upsert({
        where: {
          utenteId_societaId: {
            utenteId: utente.id,
            societaId: socio.societaId,
          },
        },
        create: {
          utenteId: utente.id,
          societaId: socio.societaId,
          ruolo: ruoloAzienda,
        },
        update: {
          ruolo: ruoloAzienda,
        },
      });
      utenteAziendaCreated++;
    }

    // d. Populate LogAttivita.societaId where missing
    if (socio.societaId != null) {
      const result = await prisma.logAttivita.updateMany({
        where: {
          userId: utente.id,
          societaId: null,
        },
        data: {
          societaId: socio.societaId,
        },
      });
      logsUpdated += result.count;
    }
  }

  console.log(`Utenti processati:       ${utentiProcessed}`);
  console.log(`UtenteAzienda creati:    ${utenteAziendaCreated}`);
  console.log(`LogAttivita aggiornati:  ${logsUpdated}`);
  console.log("\n=== Migrazione completata ===");
}

main()
  .catch((e) => {
    console.error("Errore durante la migrazione:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
