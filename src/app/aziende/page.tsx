import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AziendeContent } from "./aziende-content";

export default async function AziendePage() {
  const user = await getSessionUser();

  // Count active company associations
  const count = await prisma.utenteAzienda.count({
    where: { utenteId: user.id, attivo: true },
  });

  // If user has only 1 company, redirect to dashboard
  if (count <= 1) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <AziendeContent userName={user.nome} />
    </div>
  );
}
