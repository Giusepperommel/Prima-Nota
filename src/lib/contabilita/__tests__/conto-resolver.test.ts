import { describe, it, expect } from "vitest";
import { ContoResolver } from "../conto-resolver";

describe("ContoResolver", () => {
  const mockPdcMap = new Map<string, number>([
    ['100.010', 1], ['100.001', 10], ['110.001', 2], ['130.001', 3],
    ['200.001', 4], ['220.001', 5], ['220.004', 6],
    ['310.001', 7], ['400.001', 8],
  ]);

  const resolver = new ContoResolver(mockPdcMap);

  it("resolves structural account by key", () => {
    const result = resolver.resolveStrutturale('BANCA_CC');
    expect(result.contoId).toBe(1); // 100.010 -> id 1
    expect(result.warning).toBeNull();
  });

  it("resolves CASSA correctly (100.001, not BANCA)", () => {
    const result = resolver.resolveStrutturale('CASSA');
    expect(result.contoId).toBe(10); // 100.001 -> id 10
  });

  it("resolves category default account", () => {
    const result = resolver.resolveCategoria(7);
    expect(result.contoId).toBe(7);
    expect(result.warning).toBeNull();
  });

  it("resolves explicit account (commercialista override)", () => {
    const result = resolver.resolveEsplicito(8);
    expect(result.contoId).toBe(8);
    expect(result.warning).toBeNull();
  });

  it("returns warning when structural account not found in PdC", () => {
    const sparseMap = new Map<string, number>();
    const sparseResolver = new ContoResolver(sparseMap);
    const result = sparseResolver.resolveStrutturale('BANCA_CC');
    expect(result.contoId).toBeNull();
    expect(result.warning).toContain('100.010');
  });

  it("returns warning when category has no contoDefaultId", () => {
    const result = resolver.resolveCategoria(null);
    expect(result.contoId).toBeNull();
    expect(result.warning).toContain("conto di default");
  });

  it("resolves with priority: explicit > category > structural", () => {
    const result = resolver.resolve({
      esplicito: 8,
      categoriaContoId: 7,
      strutturale: 'BANCA_CC',
    });
    expect(result.contoId).toBe(8);
  });

  it("falls back to category when no explicit", () => {
    const result = resolver.resolve({
      esplicito: null,
      categoriaContoId: 7,
      strutturale: 'BANCA_CC',
    });
    expect(result.contoId).toBe(7);
  });

  it("falls back to structural when no explicit and no category", () => {
    const result = resolver.resolve({
      esplicito: null,
      categoriaContoId: null,
      strutturale: 'BANCA_CC',
    });
    expect(result.contoId).toBe(1);
  });

  it("getStrutturale shortcut returns id", () => {
    expect(resolver.getStrutturale('IVA_CREDITO')).toBe(3);
  });

  it("getStrutturale returns null for missing code", () => {
    const sparseResolver = new ContoResolver(new Map());
    expect(sparseResolver.getStrutturale('IVA_CREDITO')).toBeNull();
  });
});
