import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { SocietaForm } from "./societa-form";

export default async function SocietaPage() {
  const user = await requireAdmin();

  const societa = await prisma.societa.findUnique({
    where: { id: user.societaId! },
  });

  if (!societa) {
    return (
      <AuthenticatedLayout user={user} pageTitle="Gestione Societa">
        <p className="text-muted-foreground">Societa non trovata.</p>
      </AuthenticatedLayout>
    );
  }

  // Serializziamo i dati per il client component
  const societaData = {
    id: societa.id,
    ragioneSociale: societa.ragioneSociale,
    partitaIva: societa.partitaIva,
    codiceFiscale: societa.codiceFiscale,
    indirizzo: societa.indirizzo ?? "",
    regimeFiscale: societa.regimeFiscale ?? "",
    aliquotaIrap: String(Number(societa.aliquotaIrap)),
    capitaleSociale: societa.capitaleSociale ? String(Number(societa.capitaleSociale)) : "",
    dataCostituzione: societa.dataCostituzione
      ? societa.dataCostituzione.toISOString().split("T")[0]
      : "",
  };

  return (
    <AuthenticatedLayout user={user} pageTitle="Gestione Societa">
      <SocietaForm societa={societaData} />
    </AuthenticatedLayout>
  );
}
