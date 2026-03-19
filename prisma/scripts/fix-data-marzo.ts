import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Fix dati marzo 2026 ===\n");

  // 1. Delete duplicate Anthropic op (id 14)
  const op14 = await prisma.operazione.findUnique({ where: { id: 14 }, select: { id: true, descrizione: true, importoTotale: true } });
  if (op14) {
    console.log("1. Elimino duplicato Anthropic id 14:", op14.descrizione, Number(op14.importoTotale));
    await prisma.operazione.update({ where: { id: 14 }, data: { eliminato: true } });
    console.log("   -> Eliminato (soft delete)\n");
  } else {
    console.log("1. Op id 14 non trovata, skip\n");
  }

  // 2. Fix id 33: was duplicate commission 0.75, should be acconto auto 1500
  const op33 = await prisma.operazione.findUnique({ where: { id: 33 }, select: { id: true, descrizione: true, importoTotale: true } });
  if (op33) {
    console.log("2. Correggo id 33 (era commissione duplicata 0.75 -> acconto auto 1500):");
    console.log("   Prima:", op33.descrizione, Number(op33.importoTotale));
    await prisma.operazione.update({
      where: { id: 33 },
      data: {
        descrizione: "Primo acconto MG HS HEV CLEVER SRL A MALDARIZZI AUTOMOTIVE S.P.A. - BONIFICO",
        importoTotale: 1500,
        importoImponibile: 1229.51, // 1500 / 1.22
        importoIva: 270.49,
        ivaDetraibile: 270.49,
        ivaIndetraibile: 0,
      },
    });
    // Update ripartizioni for the new amount
    const rips = await prisma.ripartizioneOperazione.findMany({ where: { operazioneId: 33 } });
    for (const rip of rips) {
      const perc = Number(rip.percentuale);
      await prisma.ripartizioneOperazione.update({
        where: { id: rip.id },
        data: { importoCalcolato: Math.round(1229.51 * perc) / 100 },
      });
    }
    console.log("   Dopo: Primo acconto MG HS HEV - 1500.00\n");
  }

  // 3. Update piano pagamento auto: anticipo = 5580 (1500 + 4080), correct dates
  const piano = await prisma.pianoPagamento.findFirst({
    where: { societaId: 2 },
    include: { pagamenti: { orderBy: { numeroPagamento: "asc" } }, operazione: { select: { id: true, descrizione: true } } },
  });

  if (piano) {
    console.log("3. Aggiorno piano pagamento auto id", piano.id, "per op:", piano.operazione.descrizione);
    console.log("   Anticipo attuale:", Number(piano.anticipo), "-> nuovo: 5580");

    // Delete all existing pagamenti
    await prisma.pagamento.deleteMany({ where: { pianoPagamentoId: piano.id } });

    // Update piano: anticipo = 5580, dataInizio = 2026-02-27 (first acconto date)
    await prisma.pianoPagamento.update({
      where: { id: piano.id },
      data: {
        anticipo: 5580,
        dataInizio: new Date("2026-02-27"),
      },
    });

    // Recreate pagamenti:
    // Pag 1: acconto 1500 on 27/02 EFFETTUATO
    // Pag 2: acconto 4080 on 04/03 EFFETTUATO
    // Pag 3-98: 96 rate from 01/04/2026
    const pagamentiData: any[] = [];

    pagamentiData.push({
      pianoPagamentoId: piano.id,
      numeroPagamento: 1,
      data: new Date("2026-02-27"),
      importo: 1500,
      quotaCapitale: 1500,
      quotaInteressi: 0,
      stato: "EFFETTUATO",
      dataEffettivaPagamento: new Date("2026-02-27"),
      note: "Primo acconto Maldarizzi",
    });

    pagamentiData.push({
      pianoPagamentoId: piano.id,
      numeroPagamento: 2,
      data: new Date("2026-03-04"),
      importo: 4080,
      quotaCapitale: 4080,
      quotaInteressi: 0,
      stato: "EFFETTUATO",
      dataEffettivaPagamento: new Date("2026-03-04"),
      note: "Saldo acconto Maldarizzi",
    });

    // Remaining: importo totale auto = 32126.79, finanziato = 32126.79 - 5580 = 26546.79
    // 96 rate, using existing TAN from piano
    const importoFinanziato = Number(piano.operazione ? 32126.79 : 0) - 5580;
    const tanAnnuo = Number(piano.tan || 0);
    const nRate = Number(piano.numeroRate || 96);

    let importoRata: number;
    if (tanAnnuo > 0) {
      const tassoMensile = tanAnnuo / 100 / 12;
      importoRata = Math.round(importoFinanziato * tassoMensile / (1 - Math.pow(1 + tassoMensile, -nRate)) * 100) / 100;
    } else {
      importoRata = Math.round(importoFinanziato / nRate * 100) / 100;
    }

    let capitalResiduo = importoFinanziato;
    const dataBase = new Date("2026-04-01");

    for (let i = 0; i < nRate; i++) {
      const dataRata = new Date(dataBase);
      dataRata.setMonth(dataBase.getMonth() + i);

      const quotaInteressi = tanAnnuo > 0 ? Math.round(capitalResiduo * (tanAnnuo / 100 / 12) * 100) / 100 : 0;
      const isLast = i === nRate - 1;
      const importoEffettivo = isLast
        ? Math.round((capitalResiduo + quotaInteressi) * 100) / 100
        : importoRata;
      const quotaCapitale = Math.round((importoEffettivo - quotaInteressi) * 100) / 100;

      capitalResiduo = Math.round((capitalResiduo - quotaCapitale) * 100) / 100;

      pagamentiData.push({
        pianoPagamentoId: piano.id,
        numeroPagamento: i + 3, // starts at 3 (after 2 acconti)
        data: dataRata,
        importo: importoEffettivo,
        quotaCapitale,
        quotaInteressi,
        stato: "PREVISTO",
      });
    }

    await prisma.pagamento.createMany({ data: pagamentiData });

    // Update importoRata on piano
    await prisma.pianoPagamento.update({
      where: { id: piano.id },
      data: { importoRata },
    });

    console.log("   Creati", pagamentiData.length, "pagamenti (2 acconti EFFETTUATO +", nRate, "rate)");
    console.log("   Importo rata:", importoRata);
    console.log("   Importo finanziato:", importoFinanziato.toFixed(2), "\n");
  }

  console.log("=== Fix completato ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
