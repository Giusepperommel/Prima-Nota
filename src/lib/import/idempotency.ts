import { prisma } from "@/lib/prisma";

type FatturaKeyInput = {
  identificativoSdi?: string;
  nomeFile?: string;
  fornitorePartitaIva?: string;
  numeroFattura?: string;
  dataFattura?: string;
};

export function buildFatturaKey(input: FatturaKeyInput): string {
  if (input.identificativoSdi) return input.identificativoSdi;
  if (input.nomeFile) return input.nomeFile;
  if (input.fornitorePartitaIva && input.numeroFattura && input.dataFattura) {
    return `${input.fornitorePartitaIva}|${input.numeroFattura}|${input.dataFattura}`;
  }
  return "";
}

export async function checkDuplicateFattura(
  societaId: number,
  chiaveImport: string,
): Promise<boolean> {
  if (!chiaveImport) return false;
  const existing = await prisma.operazione.findFirst({
    where: { societaId, chiaveImport },
    select: { id: true },
  });
  return existing !== null;
}
