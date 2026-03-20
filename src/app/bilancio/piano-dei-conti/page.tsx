import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { PianoDeiContiContent } from "./piano-dei-conti-content";

export default async function PianoDeiContiPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Piano dei Conti">
      <PianoDeiContiContent />
    </AuthenticatedLayout>
  );
}
