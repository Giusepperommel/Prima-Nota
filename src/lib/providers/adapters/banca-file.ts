import type { ProviderConfig } from "@prisma/client";
import type { BancaProvider, MovimentoBancarioImportato } from "../types";

export class BancaFileAdapter implements BancaProvider {
  constructor(private config: ProviderConfig) {}

  async getMovimenti(_from: Date, _to: Date): Promise<MovimentoBancarioImportato[]> {
    return [];
  }
}
