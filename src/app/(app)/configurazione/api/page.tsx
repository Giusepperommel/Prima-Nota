import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ApiConfigContent } from "./api-config-content";

export default async function ApiConfigPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Configurazione API" user={user}>
      <ApiConfigContent />
    </AuthenticatedLayout>
  );
}
