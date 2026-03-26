import { describe, it, expect } from "vitest";
import { checkPermission, DEFAULT_PERMISSIONS } from "../permissions";

describe("portal permissions", () => {
  it("DEFAULT_PERMISSIONS has all sections", () => {
    expect(DEFAULT_PERMISSIONS).toHaveLength(10);
    const sezioni = DEFAULT_PERMISSIONS.map((p) => p.sezione);
    expect(sezioni).toContain("KPI");
    expect(sezioni).toContain("PRIMA_NOTA");
    expect(sezioni).toContain("DOCUMENTI");
    expect(sezioni).toContain("CHAT");
  });

  it("checkPermission returns true for allowed action", () => {
    const permessi = [
      { sezione: "KPI" as const, lettura: true, scrittura: false },
      { sezione: "DOCUMENTI" as const, lettura: true, scrittura: true },
    ];
    expect(checkPermission(permessi, "KPI", "lettura")).toBe(true);
    expect(checkPermission(permessi, "KPI", "scrittura")).toBe(false);
    expect(checkPermission(permessi, "DOCUMENTI", "scrittura")).toBe(true);
  });

  it("checkPermission returns false for missing section", () => {
    expect(checkPermission([], "KPI", "lettura")).toBe(false);
  });
});
