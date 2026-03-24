import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { redirect } from "next/navigation";
import { BilancioCivilisticoContent } from "./bilancio-civilistico-content";

export default async function BilancioCivilisticoPage() {
  const user = await getSessionUser();

  // Hidden in modalita semplice
  if (!user.modalitaAvanzata && !user.modalitaCommercialista) {
    redirect("/dashboard");
  }

  return (
    <AuthenticatedLayout user={user} pageTitle="Bilancio Civilistico">
      <BilancioCivilisticoContent />
    </AuthenticatedLayout>
  );
}
