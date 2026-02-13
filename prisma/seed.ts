import { PrismaClient, RuoloUtente } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Società di esempio
  const societa = await prisma.societa.create({
    data: {
      ragioneSociale: "Tech Solutions SRL",
      partitaIva: "12345678901",
      codiceFiscale: "12345678901",
      indirizzo: "Via Roma 123, Milano MI",
      regimeFiscale: "Regime ordinario",
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

  // 3. Categorie spesa standard italiane
  const categorie = [
    { nome: "Carburante auto", perc: 20.0, desc: "Art. 164 comma 1 TUIR - Uso promiscuo", tipo: "Auto" },
    { nome: "Telefonia mobile", perc: 80.0, desc: "Uso promiscuo professionale/personale", tipo: "Telecomunicazioni" },
    { nome: "Telefonia fissa ufficio", perc: 100.0, desc: "Uso esclusivo professionale", tipo: "Telecomunicazioni" },
    { nome: "Formazione e aggiornamento professionale", perc: 100.0, desc: "Corsi, seminari, libri tecnici", tipo: "Formazione" },
    { nome: "Cancelleria e materiale ufficio", perc: 100.0, desc: "", tipo: "Ufficio" },
    { nome: "Software e licenze", perc: 100.0, desc: "Abbonamenti cloud, licenze software", tipo: "IT" },
    { nome: "Hardware e computer", perc: 100.0, desc: "Beni ammortizzabili", tipo: "IT" },
    { nome: "Affitto ufficio", perc: 100.0, desc: "", tipo: "Immobili" },
    { nome: "Utenze ufficio (luce, gas, acqua)", perc: 100.0, desc: "", tipo: "Immobili" },
    { nome: "Pulizie ufficio", perc: 100.0, desc: "", tipo: "Immobili" },
    { nome: "Consulenze professionali", perc: 100.0, desc: "Commercialista, legale, tecnici", tipo: "Servizi" },
    { nome: "Spese bancarie e commissioni", perc: 100.0, desc: "", tipo: "Banca" },
    { nome: "Assicurazioni professionali", perc: 100.0, desc: "", tipo: "Assicurazioni" },
    { nome: "Marketing e pubblicità", perc: 100.0, desc: "", tipo: "Marketing" },
    { nome: "Rappresentanza", perc: 75.0, desc: "Limiti art. 108 TUIR - percentuale indicativa", tipo: "Rappresentanza" },
    { nome: "Manutenzione auto", perc: 20.0, desc: "Coerente con uso promiscuo carburante", tipo: "Auto" },
    { nome: "Assicurazione auto", perc: 20.0, desc: "Coerente con uso promiscuo", tipo: "Auto" },
    { nome: "Mobili e arredi", perc: 100.0, desc: "Beni ammortizzabili", tipo: "Ufficio" },
    { nome: "Viaggi e trasferte", perc: 100.0, desc: "Se documentati e inerenti attività", tipo: "Trasferte" },
    { nome: "Vitto e alloggio trasferte", perc: 75.0, desc: "Limiti fiscali secondo normativa", tipo: "Trasferte" },
  ];

  for (const c of categorie) {
    await prisma.categoriaSpesa.create({
      data: {
        societaId: societa.id,
        nome: c.nome,
        percentualeDeducibilita: c.perc,
        descrizione: c.desc || null,
        tipoCategoria: c.tipo,
      },
    });
  }

  console.log(`✓ ${categorie.length} categorie spesa create`);
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
