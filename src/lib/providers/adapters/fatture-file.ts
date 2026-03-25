import type { ProviderConfig } from "@prisma/client";
import type { FattureProvider, FatturaImportata } from "../types";

export class FattureFileAdapter implements FattureProvider {
  constructor(private config: ProviderConfig) {}

  async importaFatturePassive(_files?: File[]): Promise<FatturaImportata[]> {
    return [];
  }
}
