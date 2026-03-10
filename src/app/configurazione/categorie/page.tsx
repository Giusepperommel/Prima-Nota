import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { CategorieTable } from "./categorie-table";

export default async function CategorieSpesaPage() {
  const user = await requireAdmin();

  const categorie = await prisma.categoriaSpesa.findMany({
    where: { societaId: user.societaId! },
    orderBy: [{ attiva: "desc" }, { nome: "asc" }],
  });

  // Serialize Prisma Decimal values to plain numbers for the client component
  const serializedCategorie = categorie.map((cat) => ({
    ...cat,
    percentualeDeducibilita: Number(cat.percentualeDeducibilita),
    aliquotaIvaDefault: Number(cat.aliquotaIvaDefault),
    percentualeDetraibilitaIva: Number(cat.percentualeDetraibilitaIva),
    haOpzioniUso: Boolean(cat.haOpzioniUso),
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  }));

  return (
    <AuthenticatedLayout user={user} pageTitle="Gestione Categorie di Spesa">
      <CategorieTable initialData={serializedCategorie} />
    </AuthenticatedLayout>
  );
}
