import { describe, it, expect } from "vitest";
import { getEntityConfig, ALL_ENTITY_TYPES } from "../entity-configs";

describe("entity-configs", () => {
  it("returns config for operazioni", () => {
    const config = getEntityConfig("operazioni");
    expect(config.entityType).toBe("operazioni");
    expect(config.displayName).toBe("Operazioni");
    expect(config.fields.length).toBeGreaterThan(0);
    expect(config.fields[0]).toHaveProperty("key");
    expect(config.fields[0]).toHaveProperty("label");
  });

  it("returns config for all entity types", () => {
    for (const entityType of ALL_ENTITY_TYPES) {
      const config = getEntityConfig(entityType);
      expect(config.entityType).toBe(entityType);
      expect(config.fields.length).toBeGreaterThan(0);
    }
  });

  it("throws for unknown entity type", () => {
    expect(() => getEntityConfig("unknown" as any)).toThrow(
      "Tipo entità sconosciuto"
    );
  });
});
