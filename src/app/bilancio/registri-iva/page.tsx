import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { RegistriIvaContent } from "./registri-iva-content";

export default async function RegistriIvaPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Registri IVA">
      <RegistriIvaContent />
    </AuthenticatedLayout>
  );
}
