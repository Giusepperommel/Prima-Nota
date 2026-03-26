import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { NotificheContent } from "./notifiche-content";

export default async function NotifichePage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Notifiche">
      <NotificheContent />
    </AuthenticatedLayout>
  );
}
