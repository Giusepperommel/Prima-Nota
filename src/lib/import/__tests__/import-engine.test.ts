import { describe, it, expect } from "vitest";
import { getParserForSource, getDefaultMappings } from "../import-engine";

describe("import-engine", () => {
  it("returns parser for each supported source", () => {
    expect(getParserForSource("danea")).toBeDefined();
    expect(getParserForSource("teamsystem")).toBeDefined();
  });

  it("throws for unknown source", () => {
    expect(() => getParserForSource("unknown" as any)).toThrow();
  });

  it("returns default mappings for anagrafiche from danea", () => {
    const mappings = getDefaultMappings("danea", "anagrafiche");
    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings[0]).toHaveProperty("sourceKey");
    expect(mappings[0]).toHaveProperty("targetKey");
  });
});
