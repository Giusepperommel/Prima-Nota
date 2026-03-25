import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { CopilotaAdempimentiContent } from "./copilota-adempimenti-content";

export default async function CopilotaAdempimentiPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Copilota Adempimenti">
      <CopilotaAdempimentiContent />
    </AuthenticatedLayout>
  );
}
