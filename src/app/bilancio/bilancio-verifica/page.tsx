import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { redirect } from "next/navigation";
import { BilancioVerificaContent } from "./bilancio-verifica-content";

export default async function BilancioVerificaPage() {
  const user = await getSessionUser();

  // Hidden in modalita semplice
  if (!user.modalitaAvanzata && !user.modalitaCommercialista) {
    redirect("/dashboard");
  }

  return (
    <AuthenticatedLayout user={user} pageTitle="Bilancio di Verifica">
      <BilancioVerificaContent />
    </AuthenticatedLayout>
  );
}
