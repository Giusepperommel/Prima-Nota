import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { LogTable } from "./log-table";

export default async function LogAttivitaPage() {
  const user = await requireAdmin();

  // Fetch all utenti with their socio info for the filter dropdown
  const utenti = await prisma.utente.findMany({
    include: {
      socio: {
        select: {
          nome: true,
          cognome: true,
        },
      },
    },
    orderBy: {
      socio: {
        cognome: "asc",
      },
    },
  });

  const serializedUtenti = utenti.map((u) => ({
    id: u.id,
    email: u.email,
    nome: u.socio.nome,
    cognome: u.socio.cognome,
  }));

  // Fetch distinct table names for the table filter
  const tabelleDistinct = await prisma.logAttivita.findMany({
    select: { tabella: true },
    distinct: ["tabella"],
    orderBy: { tabella: "asc" },
  });

  const tabelle = tabelleDistinct.map((t) => t.tabella);

  return (
    <AuthenticatedLayout user={user} pageTitle="Log Attivita">
      <LogTable utenti={serializedUtenti} tabelle={tabelle} />
    </AuthenticatedLayout>
  );
}
