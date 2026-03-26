import { describe, it, expect, vi } from "vitest";
import { verifyCronSecret } from "../auth";

describe("cron auth", () => {
  it("returns true for valid secret", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-123");
    expect(verifyCronSecret("test-secret-123")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false for invalid secret", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-123");
    expect(verifyCronSecret("wrong-secret")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false when CRON_SECRET is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronSecret("anything")).toBe(false);
    vi.unstubAllEnvs();
  });
});
