import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { RiconciliazioneContent } from "./riconciliazione-content";

export default async function RiconciliazioneBancariaPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Riconciliazione Bancaria">
      <RiconciliazioneContent />
    </AuthenticatedLayout>
  );
}
