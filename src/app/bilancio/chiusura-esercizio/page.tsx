import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ChiusuraEsercizioContent } from "./chiusura-esercizio-content";

export default async function ChiusuraEsercizioPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout user={user} pageTitle="Chiusura Esercizio">
      <ChiusuraEsercizioContent />
    </AuthenticatedLayout>
  );
}
