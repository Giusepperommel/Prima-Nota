import { describe, it, expect } from "vitest";
import { buildEmailPayload } from "../send-email";

describe("send-email", () => {
  it("builds email payload with required fields", () => {
    const payload = buildEmailPayload({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(payload.to).toBe("test@example.com");
    expect(payload.subject).toBe("Test");
    expect(payload.html).toContain("Hello");
    expect(payload.from).toBeTruthy();
  });

  it("uses default from address", () => {
    const payload = buildEmailPayload({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
    });
    expect(payload.from).toContain("@");
  });

  it("allows custom from address", () => {
    const payload = buildEmailPayload({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      from: "custom@example.com",
    });
    expect(payload.from).toBe("custom@example.com");
  });
});
