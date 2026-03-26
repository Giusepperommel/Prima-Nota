import { prisma } from "@/lib/prisma";

type Sezione = "KPI" | "PRIMA_NOTA" | "DOCUMENTI" | "CHAT" | "IVA" | "SCADENZARIO" | "FATTURE" | "F24" | "BILANCIO" | "REPORT";

interface PermessoEntry {
  sezione: Sezione;
  lettura: boolean;
  scrittura: boolean;
}

export const DEFAULT_PERMISSIONS: PermessoEntry[] = [
  { sezione: "KPI", lettura: true, scrittura: false },
  { sezione: "PRIMA_NOTA", lettura: true, scrittura: false },
  { sezione: "DOCUMENTI", lettura: true, scrittura: true },
  { sezione: "CHAT", lettura: true, scrittura: true },
  { sezione: "IVA", lettura: true, scrittura: false },
  { sezione: "SCADENZARIO", lettura: true, scrittura: false },
  { sezione: "FATTURE", lettura: true, scrittura: false },
  { sezione: "F24", lettura: true, scrittura: false },
  { sezione: "BILANCIO", lettura: true, scrittura: false },
  { sezione: "REPORT", lettura: true, scrittura: false },
];

export function checkPermission(
  permessi: PermessoEntry[],
  sezione: Sezione,
  azione: "lettura" | "scrittura"
): boolean {
  const p = permessi.find((e) => e.sezione === sezione);
  if (!p) return false;
  return p[azione];
}

export async function getClientPermissions(accessoClienteId: number): Promise<PermessoEntry[]> {
  const dbPerms = await prisma.permessoPortale.findMany({
    where: { accessoClienteId },
  });

  if (dbPerms.length === 0) return DEFAULT_PERMISSIONS;

  return dbPerms.map((p) => ({
    sezione: p.sezione as Sezione,
    lettura: p.lettura,
    scrittura: p.scrittura,
  }));
}

export async function hasPortalePermission(
  accessoClienteId: number,
  sezione: Sezione,
  azione: "lettura" | "scrittura"
): Promise<boolean> {
  const perms = await getClientPermissions(accessoClienteId);
  return checkPermission(perms, sezione, azione);
}
