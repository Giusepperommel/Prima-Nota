import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  // Find all existing companies
  const societa = await prisma.societa.findMany();

  if (societa.length === 0) {
    console.log("No companies found. Nothing to migrate.");
    return;
  }

  for (const s of societa) {
    console.log(`Processing societa: ${s.ragioneSociale} (id: ${s.id})`);

    // Import getCategorieDefault
    const { getCategorieDefault } = await import("../src/lib/categorie-default");

    const categorieDefault = getCategorieDefault(
      (s.tipoAttivita as any) || "SRL",
      (s.regimeFiscale as any) || "ORDINARIO"
    );

    const categorieEsistenti = await prisma.categoriaSpesa.findMany({
      where: { societaId: s.id },
    });

    for (const catDefault of categorieDefault) {
      const existing = categorieEsistenti.find((c) => c.nome === catDefault.nome);
      if (existing) {
        await prisma.categoriaSpesa.update({
          where: { id: existing.id },
          data: {
            aliquotaIvaDefault: catDefault.aliquotaIvaDefault,
            percentualeDetraibilitaIva: catDefault.percentualeDetraibilitaIva,
            haOpzioniUso: catDefault.haOpzioniUso,
            opzioniUso: catDefault.opzioniUso,
          },
        });
        console.log(`  Updated category: ${catDefault.nome}`);
      } else {
        // Create missing categories
        await prisma.categoriaSpesa.create({
          data: {
            societaId: s.id,
            nome: catDefault.nome,
            percentualeDeducibilita: catDefault.percentualeDeducibilita,
            descrizione: catDefault.descrizione,
            tipoCategoria: catDefault.tipoCategoria,
            aliquotaIvaDefault: catDefault.aliquotaIvaDefault,
            percentualeDetraibilitaIva: catDefault.percentualeDetraibilitaIva,
            haOpzioniUso: catDefault.haOpzioniUso,
            opzioniUso: catDefault.opzioniUso,
          },
        });
        console.log(`  Created new category: ${catDefault.nome}`);
      }
    }

    // Recalculate existing COSTO/CESPITE operations
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId: s.id,
        eliminato: false,
        tipoOperazione: { in: ["COSTO", "CESPITE"] },
      },
      include: { categoria: true },
    });

    for (const op of operazioni) {
      const aliquota = op.aliquotaIva ? Number(op.aliquotaIva) : 22;
      const totale = Number(op.importoTotale);
      const imponibile =
        aliquota > 0
          ? Math.round((totale / (1 + aliquota / 100)) * 100) / 100
          : totale;
      const ivaTotale = Math.round((totale - imponibile) * 100) / 100;

      const percDetraibilita = Number(op.categoria.percentualeDetraibilitaIva);
      const ivaDetraibile =
        Math.round(((ivaTotale * percDetraibilita) / 100) * 100) / 100;
      const ivaIndetraibile =
        Math.round((ivaTotale - ivaDetraibile) * 100) / 100;

      // Costo fiscale = imponibile + IVA indetraibile
      const costoFiscale = imponibile + ivaIndetraibile;
      const percDeduc = Number(op.percentualeDeducibilita);
      const importoDeducibile =
        Math.round(((costoFiscale * percDeduc) / 100) * 100) / 100;

      await prisma.operazione.update({
        where: { id: op.id },
        data: {
          aliquotaIva: aliquota,
          importoImponibile: imponibile,
          importoIva: ivaTotale,
          percentualeDetraibilitaIva: percDetraibilita,
          ivaDetraibile,
          ivaIndetraibile,
          importoDeducibile,
        },
      });
    }

    console.log(`  Updated ${operazioni.length} operations`);
  }

  console.log("Migration complete!");
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
