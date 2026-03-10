import { PrismaClient, RuoloUtente } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getCategorieDefault } from "../src/lib/categorie-default";

const prisma = new PrismaClient();

async function main() {
  // 1. Società di esempio
  const societa = await prisma.societa.create({
    data: {
      ragioneSociale: "Tech Solutions SRL",
      partitaIva: "12345678901",
      codiceFiscale: "12345678901",
      indirizzo: "Via Roma 123, Milano MI",
      tipoAttivita: "SRL",
      regimeFiscale: "ORDINARIO",
      capitaleSociale: 50000.00,
      dataCostituzione: new Date("2020-01-15"),
    },
  });

  console.log("✓ Società creata:", societa.ragioneSociale);

  // 2. Soci
  const sociData = [
    { nome: "Mario", cognome: "Rossi", cf: "RSSMRA80A01H501Z", email: "mario.rossi@example.com", quota: 40.0, ruolo: RuoloUtente.ADMIN, ingresso: "2020-01-15" },
    { nome: "Laura", cognome: "Bianchi", cf: "BNCLRA85M45F205W", email: "laura.bianchi@example.com", quota: 30.0, ruolo: RuoloUtente.ADMIN, ingresso: "2020-01-15" },
    { nome: "Giuseppe", cognome: "Verdi", cf: "VRDGPP75C15L219K", email: "giuseppe.verdi@example.com", quota: 20.0, ruolo: RuoloUtente.STANDARD, ingresso: "2020-01-15" },
    { nome: "Anna", cognome: "Neri", cf: "NRINNA90D50F839P", email: "anna.neri@example.com", quota: 10.0, ruolo: RuoloUtente.STANDARD, ingresso: "2021-06-01" },
  ];

  const passwordHash = await bcrypt.hash("password123", 12);

  for (const s of sociData) {
    const socio = await prisma.socio.create({
      data: {
        societaId: societa.id,
        nome: s.nome,
        cognome: s.cognome,
        codiceFiscale: s.cf,
        email: s.email,
        quotaPercentuale: s.quota,
        ruolo: s.ruolo,
        dataIngresso: new Date(s.ingresso),
      },
    });

    await prisma.utente.create({
      data: {
        socioId: socio.id,
        email: s.email,
        passwordHash,
        emailVerificata: true,
      },
    });

    console.log(`✓ Socio creato: ${s.nome} ${s.cognome} (${s.ruolo}, ${s.quota}%)`);
  }

  // Super Admin (sviluppatore)
  const superAdminSocio = await prisma.socio.create({
    data: {
      nome: "Super",
      cognome: "Admin",
      email: "admin@primanota.dev",
      codiceFiscale: "SUPERADMIN000000",
      quotaPercentuale: 0,
      ruolo: RuoloUtente.SUPER_ADMIN,
      societaId: null,
    },
  });

  await prisma.utente.create({
    data: {
      socioId: superAdminSocio.id,
      email: "admin@primanota.dev",
      passwordHash,
      emailVerificata: true,
    },
  });

  console.log("✓ Super Admin creato: admin@primanota.dev");

  // 3. Categorie spesa standard italiane (da config centralizzata)
  const categorieDefault = getCategorieDefault("SRL", "ORDINARIO");

  await prisma.categoriaSpesa.createMany({
    data: categorieDefault.map((c) => ({
      societaId: societa.id,
      nome: c.nome,
      percentualeDeducibilita: c.percentualeDeducibilita,
      descrizione: c.descrizione || null,
      tipoCategoria: c.tipoCategoria,
      aliquotaIvaDefault: c.aliquotaIvaDefault,
      percentualeDetraibilitaIva: c.percentualeDetraibilitaIva,
      haOpzioniUso: c.haOpzioniUso,
      opzioniUso: c.opzioniUso,
    })),
  });

  console.log(`✓ ${categorieDefault.length} categorie spesa create`);
  console.log("\n✅ Seed completato!");
  console.log("\nCredenziali di accesso:");
  console.log("  mario.rossi@example.com / password123 (Admin)");
  console.log("  laura.bianchi@example.com / password123 (Admin)");
  console.log("  giuseppe.verdi@example.com / password123 (Standard)");
  console.log("  anna.neri@example.com / password123 (Standard)");
  console.log("  admin@primanota.dev / password123 (Super Admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
