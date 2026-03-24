import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { LiquidazioniIvaContent } from "./liquidazioni-iva-content";

export default async function LiquidazioniIvaPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Liquidazioni IVA">
      <LiquidazioniIvaContent />
    </AuthenticatedLayout>
  );
}
