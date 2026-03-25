import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ConservazioneContent } from "./conservazione-content";

export default async function ConservazionePage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Conservazione Sostitutiva">
      <ConservazioneContent />
    </AuthenticatedLayout>
  );
}
