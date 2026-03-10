import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { RicorrenzeTable } from "./ricorrenze-table";

export default async function RicorrenzePage() {
  const user = await requireAdmin();

  return (
    <AuthenticatedLayout user={user} pageTitle="Gestione Ricorrenze">
      <RicorrenzeTable />
    </AuthenticatedLayout>
  );
}
