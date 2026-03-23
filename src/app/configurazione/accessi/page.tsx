import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { AccessiContent } from "./accessi-content";

export default async function AccessiPage() {
  const user = await requireAdmin();

  // Fetch utenti for the log filter dropdown
  const utenti = await prisma.utenteAzienda.findMany({
    where: { societaId: user.societaId! },
    include: {
      utente: {
        select: { id: true, nome: true, cognome: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const serializedUtenti = utenti.map((ua) => ({
    id: ua.utente.id,
    nome: ua.utente.nome,
    cognome: ua.utente.cognome,
    email: ua.utente.email,
  }));

  // Fetch distinct table names for the log table filter
  const tabelleDistinct = await prisma.logAttivita.findMany({
    where: { societaId: user.societaId! },
    select: { tabella: true },
    distinct: ["tabella"],
    orderBy: { tabella: "asc" },
  });

  const tabelle = tabelleDistinct.map((t) => t.tabella);

  return (
    <AuthenticatedLayout user={user} pageTitle="Accessi e Attivita">
      <AccessiContent
        currentUserId={user.id}
        utenti={serializedUtenti}
        tabelle={tabelle}
      />
    </AuthenticatedLayout>
  );
}
