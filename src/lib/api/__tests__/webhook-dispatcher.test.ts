import { describe, it, expect } from "vitest";
import { signWebhookPayload, verifyWebhookSignature, RETRY_DELAYS } from "../webhook-dispatcher";

describe("webhook-dispatcher", () => {
  const secret = "test-secret-123";
  const payload = JSON.stringify({ evento: "operazione.created", data: { id: 1 } });

  it("signs payload with HMAC-SHA256", () => {
    const signature = signWebhookPayload(payload, secret);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifies correct signature", () => {
    const signature = signWebhookPayload(payload, secret);
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects wrong signature", () => {
    expect(verifyWebhookSignature(payload, "sha256=wrong", secret)).toBe(false);
  });

  it("has correct retry delays", () => {
    expect(RETRY_DELAYS).toEqual([60000, 300000, 1800000, 7200000, 43200000]);
  });
});
