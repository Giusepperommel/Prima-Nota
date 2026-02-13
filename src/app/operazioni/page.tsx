import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { OperazioniList } from "./operazioni-list";

export default async function OperazioniPage() {
  const user = await getSessionUser();

  const [soci, categorie] = await Promise.all([
    prisma.socio.findMany({
      where: { societaId: user.societaId!, attivo: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, cognome: true, quotaPercentuale: true },
    }),
    prisma.categoriaSpesa.findMany({
      where: { societaId: user.societaId!, attiva: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const serializedSoci = soci.map((s) => ({
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    quotaPercentuale: Number(s.quotaPercentuale),
  }));

  return (
    <AuthenticatedLayout user={user} pageTitle="Operazioni">
      <OperazioniList
        soci={serializedSoci}
        categorie={categorie}
        ruolo={user.ruolo}
        userId={user.id}
      />
    </AuthenticatedLayout>
  );
}
