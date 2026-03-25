import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDuplicateFattura, buildFatturaKey } from "../import/idempotency";

vi.mock("../prisma", () => ({
  prisma: {
    operazione: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

describe("buildFatturaKey", () => {
  it("builds key from identificativoSdi", () => {
    const key = buildFatturaKey({ identificativoSdi: "SDI123", nomeFile: "IT01.xml" });
    expect(key).toBe("SDI123");
  });

  it("falls back to nomeFile when no identificativoSdi", () => {
    const key = buildFatturaKey({ nomeFile: "IT01_00001.xml" });
    expect(key).toBe("IT01_00001.xml");
  });

  it("falls back to fornitore+numero+data composite key", () => {
    const key = buildFatturaKey({
      fornitorePartitaIva: "01234567890",
      numeroFattura: "FT-001",
      dataFattura: "2026-03-15",
    });
    expect(key).toBe("01234567890|FT-001|2026-03-15");
  });
});

describe("checkDuplicateFattura", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns true when operazione with same key exists", async () => {
    vi.mocked(prisma.operazione.findFirst).mockResolvedValue({ id: 1 } as any);
    const result = await checkDuplicateFattura(1, "SDI123");
    expect(result).toBe(true);
  });

  it("returns false when no matching operazione exists", async () => {
    vi.mocked(prisma.operazione.findFirst).mockResolvedValue(null);
    const result = await checkDuplicateFattura(1, "SDI123");
    expect(result).toBe(false);
  });
});
