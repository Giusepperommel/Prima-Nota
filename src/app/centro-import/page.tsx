import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { CentroImportContent } from "./centro-import-content";

export default async function CentroImportPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Centro Import">
      <CentroImportContent />
    </AuthenticatedLayout>
  );
}
