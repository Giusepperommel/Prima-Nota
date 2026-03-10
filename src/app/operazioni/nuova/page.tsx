import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { OperazioneForm } from "../operazione-form";

export default async function NuovaOperazionePage() {
  const user = await getSessionUser();

  const [soci, categorie, preferenzeUso, societa] = await Promise.all([
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
    aliquotaIvaDefault: Number(c.aliquotaIvaDefault),
    percentualeDetraibilitaIva: Number(c.percentualeDetraibilitaIva),
    haOpzioniUso: c.haOpzioniUso,
    opzioniUso: c.opzioniUso as any,
  }));

  return (
    <AuthenticatedLayout user={user} pageTitle="Nuova Operazione">
      <OperazioneForm
        soci={serializedSoci}
        categorie={serializedCategorie}
        preferenzeUso={preferenzeUso}
        regimeFiscale={societa?.regimeFiscale || "ORDINARIO"}
        tipoAttivita={societa?.tipoAttivita || "SRL"}
      />
    </AuthenticatedLayout>
  );
}
