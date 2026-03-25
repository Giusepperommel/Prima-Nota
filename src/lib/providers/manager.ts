import { prisma } from "@/lib/prisma";
import type { ProviderConfig, ProviderTipo } from "@prisma/client";
import type { FattureProvider, BancaProvider } from "./types";
import { FattureFileAdapter } from "./adapters/fatture-file";
import { BancaFileAdapter } from "./adapters/banca-file";

export class ProviderManager {
  constructor(private societaId: number) {}

  async getFattureProvider(): Promise<FattureProvider | null> {
    const config = await this.findActiveConfig("FATTURE");
    if (!config) return null;
    return this.createFattureAdapter(config);
  }

  async getBancaProvider(): Promise<BancaProvider | null> {
    const config = await this.findActiveConfig("BANCA");
    if (!config) return null;
    return this.createBancaAdapter(config);
  }

  async getActiveProviders(): Promise<ProviderConfig[]> {
    return prisma.providerConfig.findMany({
      where: { societaId: this.societaId, stato: "ATTIVO" },
    });
  }

  private async findActiveConfig(tipo: ProviderTipo): Promise<ProviderConfig | null> {
    return prisma.providerConfig.findFirst({
      where: { societaId: this.societaId, tipo, stato: "ATTIVO" },
    });
  }

  private createFattureAdapter(config: ProviderConfig): FattureProvider {
    switch (config.provider) {
      case "FILE":
        return new FattureFileAdapter(config);
      case "ARUBA":
      case "INFOCERT":
        throw new Error(`Provider ${config.provider} non ancora implementato`);
      default:
        throw new Error(`Provider fatture sconosciuto: ${config.provider}`);
    }
  }

  private createBancaAdapter(config: ProviderConfig): BancaProvider {
    switch (config.provider) {
      case "FILE":
        return new BancaFileAdapter(config);
      case "FABRICK":
      case "NORDIGEN":
        throw new Error(`Provider ${config.provider} non ancora implementato`);
      default:
        throw new Error(`Provider banca sconosciuto: ${config.provider}`);
    }
  }
}
