import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { ReportClient } from "./report-client";

export default async function ReportPage() {
  const user = await getSessionUser();

  // Load active soci for admin dropdown
  const soci = await prisma.socio.findMany({
    where: { societaId: user.societaId!, attivo: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true, quotaPercentuale: true },
  });

  const serializedSoci = soci.map((s) => ({
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    quotaPercentuale: Number(s.quotaPercentuale),
  }));

  return (
    <AuthenticatedLayout user={user} pageTitle="Report">
      <ReportClient
        ruolo={user.ruolo}
        socioId={user.socioId}
        soci={serializedSoci}
      />
    </AuthenticatedLayout>
  );
}
