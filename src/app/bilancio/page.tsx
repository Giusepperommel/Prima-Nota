import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BilancioContent } from "./bilancio-content";

export default async function BilancioPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Bilancio">
      <BilancioContent />
    </AuthenticatedLayout>
  );
}
