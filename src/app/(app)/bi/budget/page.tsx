import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BudgetContent } from "./budget-content";

export default async function BudgetPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Budget">
      <BudgetContent />
    </AuthenticatedLayout>
  );
}
