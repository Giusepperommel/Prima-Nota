import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BiContent } from "./bi-content";

export default async function BiPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Business Intelligence">
      <BiContent />
    </AuthenticatedLayout>
  );
}
