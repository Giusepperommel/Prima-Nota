import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { EsportazioniContent } from "./esportazioni-content";

export default async function EsportazioniPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Esportazioni" user={user}>
      <EsportazioniContent />
    </AuthenticatedLayout>
  );
}
