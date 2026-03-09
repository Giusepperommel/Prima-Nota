import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const user = await getSessionUser();

  return (
    <AuthenticatedLayout user={user} pageTitle="Dashboard">
      <DashboardContent
        ruolo={user.ruolo}
        nome={user.nome}
      />
    </AuthenticatedLayout>
  );
}
