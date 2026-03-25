import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { SaluteAziendaContent } from "./salute-azienda-content";

export default async function SaluteAziendaPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Salute Azienda">
      <SaluteAziendaContent
        isCommercialista={user.modalitaCommercialista}
      />
    </AuthenticatedLayout>
  );
}
