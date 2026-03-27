import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AlertConfigContent } from "./alert-config-content";

export default async function AlertConfigPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Configurazione Alert" user={user}>
      <AlertConfigContent />
    </AuthenticatedLayout>
  );
}
