import { describe, it, expect } from "vitest";
import { generateOpenApiSpec } from "../openapi-schema";

describe("openapi-schema", () => {
  it("generates valid OpenAPI 3.0 structure", () => {
    const spec = generateOpenApiSpec();
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
    expect(spec.paths).toBeDefined();
  });

  it("includes all v1 endpoints", () => {
    const spec = generateOpenApiSpec();
    const paths = Object.keys(spec.paths);
    expect(paths).toContain("/api/v1/operazioni");
    expect(paths).toContain("/api/v1/alert");
    expect(paths).toContain("/api/v1/todo");
    expect(paths).toContain("/api/v1/kpi");
    expect(paths).toContain("/api/v1/report");
  });

  it("includes security scheme for API key", () => {
    const spec = generateOpenApiSpec();
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth.type).toBe("http");
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });
});
