import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OperazioneForm } from "../operazione-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DettaglioOperazionePage({ params }: Props) {
  const { id } = await params;
  const operazioneId = parseInt(id, 10);

  if (isNaN(operazioneId)) {
    notFound();
  }

  const user = await getSessionUser();

  const operazione = await prisma.operazione.findFirst({
    where: {
      id: operazioneId,
      societaId: user.societaId!,
      eliminato: false,
    },
    include: {
      categoria: {
        select: { id: true, nome: true, percentualeDeducibilita: true },
      },
      createdBy: {
        select: {
          id: true,
          socio: { select: { id: true, nome: true, cognome: true } },
        },
      },
      ripartizioni: {
        include: {
          socio: {
            select: {
              id: true,
              nome: true,
              cognome: true,
              quotaPercentuale: true,
            },
          },
        },
        orderBy: { socio: { cognome: "asc" } },
      },
    },
  });

  if (!operazione) {
    notFound();
  }

  // Check access for STANDARD users
  if (user.ruolo === "STANDARD") {
    const isCreator = operazione.createdByUserId === user.id;
    const hasRipartizione = operazione.ripartizioni.some(
      (r) => r.socioId === user.socioId
    );
    if (!isCreator && !hasRipartizione) {
      notFound();
    }
  }

  // Determine if user can edit
  const canEdit =
    user.ruolo === "ADMIN" || operazione.createdByUserId === user.id;

  // Load soci and categorie for the form
  const [soci, categorie] = await Promise.all([
    prisma.socio.findMany({
      where: { societaId: user.societaId!, attivo: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        cognome: true,
        quotaPercentuale: true,
      },
    }),
    prisma.categoriaSpesa.findMany({
      where: { societaId: user.societaId!, attiva: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        percentualeDeducibilita: true,
      },
    }),
  ]);

  const serializedSoci = soci.map((s) => ({
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    quotaPercentuale: Number(s.quotaPercentuale),
  }));

  const serializedCategorie = categorie.map((c) => ({
    id: c.id,
    nome: c.nome,
    percentualeDeducibilita: Number(c.percentualeDeducibilita),
  }));

  // Serialize the operazione for the client
  const serializedOperazione = {
    id: operazione.id,
    tipoOperazione: operazione.tipoOperazione,
    dataOperazione: operazione.dataOperazione.toISOString(),
    numeroDocumento: operazione.numeroDocumento,
    descrizione: operazione.descrizione,
    importoTotale: Number(operazione.importoTotale),
    categoriaId: operazione.categoriaId,
    importoDeducibile: Number(operazione.importoDeducibile),
    percentualeDeducibilita: Number(operazione.percentualeDeducibilita),
    deducibilitaCustom: operazione.deducibilitaCustom,
    tipoRipartizione: operazione.tipoRipartizione,
    note: operazione.note,
    createdByUserId: operazione.createdByUserId,
    categoria: {
      id: operazione.categoria.id,
      nome: operazione.categoria.nome,
      percentualeDeducibilita: Number(
        operazione.categoria.percentualeDeducibilita
      ),
    },
    ripartizioni: operazione.ripartizioni.map((rip) => ({
      id: rip.id,
      socioId: rip.socioId,
      percentuale: Number(rip.percentuale),
      importoCalcolato: Number(rip.importoCalcolato),
      socio: {
        id: rip.socio.id,
        nome: rip.socio.nome,
        cognome: rip.socio.cognome,
        quotaPercentuale: Number(rip.socio.quotaPercentuale),
      },
    })),
  };

  const pageTitle = canEdit
    ? `Modifica Operazione #${operazione.id}`
    : `Dettaglio Operazione #${operazione.id}`;

  return (
    <AuthenticatedLayout user={user} pageTitle={pageTitle}>
      <OperazioneForm
        soci={serializedSoci}
        categorie={serializedCategorie}
        operazione={serializedOperazione}
        readOnly={!canEdit}
      />
    </AuthenticatedLayout>
  );
}
