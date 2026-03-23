import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { redirect } from "next/navigation";
import { LibroGiornaleContent } from "./libro-giornale-content";

export default async function LibroGiornalePage() {
  const user = await getSessionUser();

  // Hidden in modalita semplice
  if (!user.modalitaAvanzata && !user.modalitaCommercialista) {
    redirect("/dashboard");
  }

  return (
    <AuthenticatedLayout user={user} pageTitle="Libro Giornale">
      <LibroGiornaleContent
        isCommercialista={user.modalitaCommercialista}
      />
    </AuthenticatedLayout>
  );
}
