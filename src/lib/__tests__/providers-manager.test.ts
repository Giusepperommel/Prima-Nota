import { describe, it, expect, vi } from "vitest";
import type { ProviderConfig } from "@prisma/client";
import { FattureFileAdapter } from "../providers/adapters/fatture-file";
import { BancaFileAdapter } from "../providers/adapters/banca-file";

vi.mock("../prisma", () => ({
  prisma: {
    providerConfig: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { ProviderManager } from "../providers/manager";

const mockFindFirst = prisma.providerConfig.findFirst as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.providerConfig.findMany as ReturnType<typeof vi.fn>;

const baseConfig: ProviderConfig = {
  id: 1,
  societaId: 1,
  tipo: "FATTURE",
  provider: "FILE",
  stato: "ATTIVO",
  credenziali: null,
  configExtra: null,
  ultimoSync: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ProviderManager", () => {
  describe("getFattureProvider", () => {
    it("returns FattureFileAdapter when provider is FILE and stato is ATTIVO", async () => {
      mockFindFirst.mockResolvedValueOnce({ ...baseConfig, tipo: "FATTURE", provider: "FILE", stato: "ATTIVO" });
      const manager = new ProviderManager(1);
      const provider = await manager.getFattureProvider();
      expect(provider).toBeInstanceOf(FattureFileAdapter);
    });

    it("returns null when no provider configured", async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const manager = new ProviderManager(1);
      const provider = await manager.getFattureProvider();
      expect(provider).toBeNull();
    });

    it("returns null when provider is in ERRORE state", async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const manager = new ProviderManager(1);
      const provider = await manager.getFattureProvider();
      expect(provider).toBeNull();
    });
  });

  describe("getBancaProvider", () => {
    it("returns BancaFileAdapter when provider is FILE and stato is ATTIVO", async () => {
      mockFindFirst.mockResolvedValueOnce({ ...baseConfig, tipo: "BANCA", provider: "FILE", stato: "ATTIVO" });
      const manager = new ProviderManager(1);
      const provider = await manager.getBancaProvider();
      expect(provider).toBeInstanceOf(BancaFileAdapter);
    });
  });

  describe("getActiveProviders", () => {
    it("returns all active providers for a societa", async () => {
      const configs = [
        { ...baseConfig, tipo: "FATTURE", provider: "FILE", stato: "ATTIVO" },
        { ...baseConfig, id: 2, tipo: "BANCA", provider: "FILE", stato: "ATTIVO" },
      ];
      mockFindMany.mockResolvedValueOnce(configs);
      const manager = new ProviderManager(1);
      const providers = await manager.getActiveProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toEqual(configs);
    });
  });
});
