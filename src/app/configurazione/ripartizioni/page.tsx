import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { PresetRipartizioniClient } from "./preset-ripartizioni-client";

export default async function PresetRipartizioniPage() {
  const user = await requireAdmin();

  const [presets, soci] = await Promise.all([
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
    prisma.socio.findMany({
      where: { societaId: user.societaId! },
      select: { id: true, nome: true, cognome: true, attivo: true },
      orderBy: [{ attivo: "desc" }, { cognome: "asc" }],
    }),
  ]);

  const serializedPresets = presets.map((p) => ({
    ...p,
    tipiOperazione: p.tipiOperazione as string[],
    soci: p.soci.map((s) => ({
      ...s,
      percentuale: Number(s.percentuale),
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <AuthenticatedLayout user={user} pageTitle="Preset di Ripartizione">
      <PresetRipartizioniClient
        initialPresets={serializedPresets}
        soci={soci}
      />
    </AuthenticatedLayout>
  );
}
