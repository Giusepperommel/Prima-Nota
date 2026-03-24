import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ConfigurazioneFatturazioneContent } from "./configurazione-fatturazione-content";

export default async function ConfigurazioneFatturazionePage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Configurazione Fatturazione">
      <ConfigurazioneFatturazioneContent />
    </AuthenticatedLayout>
  );
}
