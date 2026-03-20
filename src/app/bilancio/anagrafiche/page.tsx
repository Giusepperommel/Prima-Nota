import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AnagraficheContent } from "./anagrafiche-content";

export default async function AnagrafichePage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Anagrafiche">
      <AnagraficheContent />
    </AuthenticatedLayout>
  );
}
