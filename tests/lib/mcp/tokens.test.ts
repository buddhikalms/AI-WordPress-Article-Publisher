import { describe, expect, it } from "vitest";
import { generateClientId, generateOpaqueToken, hashToken } from "@/lib/mcp/tokens";

describe("mcp tokens", () => {
  it("generates unique high-entropy opaque tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes deterministically so a stored hash can be matched on lookup", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(token);
  });

  it("never stores the raw token as its own hash", () => {
    const token = "some-raw-token-value";
    expect(hashToken(token)).not.toContain(token);
  });

  it("generates client ids with a stable, identifiable prefix", () => {
    expect(generateClientId()).toMatch(/^mcp_[a-f0-9]{32}$/);
  });
});
