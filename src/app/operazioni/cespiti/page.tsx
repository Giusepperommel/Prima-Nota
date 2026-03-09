import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { CespitiList } from "./cespiti-list";

export default async function CespitiPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Registro Cespiti">
      <CespitiList ruolo={user.ruolo} />
    </AuthenticatedLayout>
  );
}
