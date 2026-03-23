import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { redirect } from "next/navigation";
import { LibroMastroContent } from "./libro-mastro-content";

export default async function LibroMastroPage() {
  const user = await getSessionUser();

  // Hidden in modalita semplice
  if (!user.modalitaAvanzata && !user.modalitaCommercialista) {
    redirect("/dashboard");
  }

  return (
    <AuthenticatedLayout user={user} pageTitle="Libro Mastro">
      <LibroMastroContent />
    </AuthenticatedLayout>
  );
}
