import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { FattureElettronicheContent } from "./fatture-elettroniche-content";

export default async function FattureElettronichePage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Fatture Elettroniche">
      <FattureElettronicheContent />
    </AuthenticatedLayout>
  );
}
