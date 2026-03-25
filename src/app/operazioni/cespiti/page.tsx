import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { CespitiTabs } from "./cespiti-tabs";

export default async function CespitiPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Registro Cespiti">
      <CespitiTabs ruolo={user.ruolo} />
    </AuthenticatedLayout>
  );
}
