import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { PartitarioContent } from "./partitario-content";

export default async function PartitarioPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Partitario Clienti/Fornitori">
      <PartitarioContent />
    </AuthenticatedLayout>
  );
}
