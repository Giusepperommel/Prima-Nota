import { describe, it, expect } from "vitest";
import { suggerisciConto } from "../mapping-categoria-conto";

describe("suggerisciConto", () => {
  it("maps 'Consulenze professionali' to 310.001", () => {
    expect(suggerisciConto("Consulenze professionali")).toBe("310.001");
  });
  it("maps 'Energia elettrica' to 310.010", () => {
    expect(suggerisciConto("Energia elettrica")).toBe("310.010");
  });
  it("returns null for unknown category", () => {
    expect(suggerisciConto("Categoria sconosciuta")).toBeNull();
  });
  it("maps 'Affitto ufficio' to 320.001", () => {
    expect(suggerisciConto("Affitto ufficio")).toBe("320.001");
  });
});
