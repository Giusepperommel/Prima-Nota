import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { SociClient } from "./soci-client";

export default async function SociPage() {
  const user = await requireAdmin();

  const soci = await prisma.socio.findMany({
    where: { societaId: user.societaId! },
    orderBy: [{ attivo: "desc" }, { cognome: "asc" }, { nome: "asc" }],
    include: {
      utente: {
        select: { id: true, ultimoAccesso: true },
      },
    },
  });

  const serialized = soci.map((s) => ({
    id: s.id,
    societaId: s.societaId,
    nome: s.nome,
    cognome: s.cognome,
    codiceFiscale: s.codiceFiscale,
    email: s.email,
    quotaPercentuale: Number(s.quotaPercentuale),
    ruolo: s.ruolo,
    dataIngresso: s.dataIngresso
      ? s.dataIngresso.toISOString().split("T")[0]
      : null,
    attivo: s.attivo,
    hasAccount: !!s.utente,
    ultimoAccesso: s.utente?.ultimoAccesso?.toISOString() ?? null,
  }));

  // Calcola somma quote soci attivi
  const sommaQuote = serialized
    .filter((s) => s.attivo)
    .reduce((sum, s) => sum + s.quotaPercentuale, 0);

  return (
    <AuthenticatedLayout user={user} pageTitle="Gestione Soci">
      <SociClient
        initialSoci={serialized}
        initialSommaQuote={sommaQuote}
        currentSocioId={user.socioId}
      />
    </AuthenticatedLayout>
  );
}
