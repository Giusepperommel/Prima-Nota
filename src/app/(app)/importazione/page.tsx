import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ImportazioneContent } from "./importazione-content";

export default async function ImportazionePage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Importazione Dati" user={user}>
      <ImportazioneContent />
    </AuthenticatedLayout>
  );
}
