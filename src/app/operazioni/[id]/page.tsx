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
  const [soci, categorie, preferenzeUso, societa, presetRipartizioni] = await Promise.all([
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
        aliquotaIvaDefault: true,
        percentualeDetraibilitaIva: true,
        haOpzioniUso: true,
        opzioniUso: true,
      },
    }),
    prisma.preferenzaUsoCategoria.findMany({
      where: { userId: user.id as number },
    }),
    prisma.societa.findFirst({
      where: { id: user.societaId! },
      select: { regimeFiscale: true, tipoAttivita: true },
    }),
    prisma.presetRipartizione.findMany({
      where: { societaId: user.societaId! },
      include: {
        soci: {
          include: {
            socio: {
              select: { id: true, nome: true, cognome: true, attivo: true },
            },
          },
        },
      },
      orderBy: { ordinamento: "asc" },
    }),
  ]);

  const serializedSoci = soci.map((s) => ({
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    quotaPercentuale: Number(s.quotaPercentuale),
  }));

  const serializedPresets = presetRipartizioni.map((p) => ({
    id: p.id,
    nome: p.nome,
    tipiOperazione: p.tipiOperazione as string[],
    ordinamento: p.ordinamento,
    soci: p.soci.map((s) => ({
      socioId: s.socioId,
      percentuale: Number(s.percentuale),
      socio: s.socio,
    })),
  }));

  const serializedCategorie = categorie.map((c) => ({
    id: c.id,
    nome: c.nome,
    percentualeDeducibilita: Number(c.percentualeDeducibilita),
    aliquotaIvaDefault: Number(c.aliquotaIvaDefault),
    percentualeDetraibilitaIva: Number(c.percentualeDetraibilitaIva),
    haOpzioniUso: c.haOpzioniUso,
    opzioniUso: c.opzioniUso as any,
  }));

  // Load cespite data if this is a CESPITE operation
  const cespite = operazione.tipoOperazione === "CESPITE"
    ? await prisma.cespite.findUnique({
        where: { operazioneId: operazione.id },
        include: {
          quoteAmmortamento: { orderBy: { anno: "asc" } },
        },
      })
    : null;

  // Serialize the operazione for the client
  const serializedOperazione = {
    id: operazione.id,
    tipoOperazione: operazione.tipoOperazione,
    dataOperazione: operazione.dataOperazione.toISOString(),
    numeroDocumento: operazione.numeroDocumento,
    descrizione: operazione.descrizione,
    importoTotale: Number(operazione.importoTotale),
    aliquotaIva: operazione.aliquotaIva ? Number(operazione.aliquotaIva) : null,
    importoImponibile: operazione.importoImponibile ? Number(operazione.importoImponibile) : null,
    importoIva: operazione.importoIva ? Number(operazione.importoIva) : null,
    percentualeDetraibilitaIva: operazione.percentualeDetraibilitaIva ? Number(operazione.percentualeDetraibilitaIva) : null,
    ivaDetraibile: operazione.ivaDetraibile ? Number(operazione.ivaDetraibile) : null,
    ivaIndetraibile: operazione.ivaIndetraibile ? Number(operazione.ivaIndetraibile) : null,
    opzioneUso: operazione.opzioneUso ?? null,
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
    cespite: cespite
      ? {
          id: cespite.id,
          aliquotaAmmortamento: Number(cespite.aliquotaAmmortamento),
          valoreIniziale: Number(cespite.valoreIniziale),
          stato: cespite.stato,
          fondoAmmortamento: Number(cespite.fondoAmmortamento),
          annoInizio: cespite.annoInizio,
        }
      : null,
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
        preferenzeUso={preferenzeUso}
        regimeFiscale={societa?.regimeFiscale || "ORDINARIO"}
        tipoAttivita={societa?.tipoAttivita || "SRL"}
        presets={serializedPresets}
      />
    </AuthenticatedLayout>
  );
}
