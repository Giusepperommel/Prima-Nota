import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { InboxContent } from "./inbox-content";

export default async function PortaleInboxPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Inbox Portale">
      <InboxContent />
    </AuthenticatedLayout>
  );
}
