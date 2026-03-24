import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { DichiarazioniContent } from "./dichiarazioni-content";

export default async function DichiarazioniPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Dichiarazioni Fiscali">
      <DichiarazioniContent />
    </AuthenticatedLayout>
  );
}
