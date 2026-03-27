import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { DeliveryContent } from "./delivery-content";

export default async function WebhookDeliveryPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Storico Webhook" user={user}>
      <DeliveryContent />
    </AuthenticatedLayout>
  );
}
