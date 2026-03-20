import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { RitenuteContent } from "./ritenute-content";

export default async function RitenutePage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Ritenute">
      <RitenuteContent />
    </AuthenticatedLayout>
  );
}
