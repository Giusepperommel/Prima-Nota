import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { PortaleConfigContent } from "./portale-config-content";
import { prisma } from "@/lib/prisma";

export default async function PortaleConfigPage() {
  const user = await requireAdmin();

  // Fetch clienti for the permission matrix
  const clienti = await prisma.accessoCliente.findMany({
    where: { societaId: user.societaId! },
    select: {
      id: true,
      nome: true,
      email: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AuthenticatedLayout pageTitle="Configurazione Portale" user={user}>
      <PortaleConfigContent clienti={clienti} />
    </AuthenticatedLayout>
  );
}
