import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AccountContent } from "./account-content";

export default async function AccountSettingsPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Impostazioni Account">
      <AccountContent />
    </AuthenticatedLayout>
  );
}
