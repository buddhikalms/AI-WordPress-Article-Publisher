import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/mcp/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the per-user limit and blocks beyond it", () => {
    const userId = `rate-limit-test-${Math.random()}`;
    let allowed = 0;
    for (let i = 0; i < 60; i += 1) {
      if (checkRateLimit(userId)) {
        allowed += 1;
      }
    }
    expect(allowed).toBe(60);
    expect(checkRateLimit(userId)).toBe(false);
  });

  it("tracks separate buckets per user", () => {
    const userA = `rate-limit-a-${Math.random()}`;
    const userB = `rate-limit-b-${Math.random()}`;
    for (let i = 0; i < 60; i += 1) {
      checkRateLimit(userA);
    }
    expect(checkRateLimit(userA)).toBe(false);
    expect(checkRateLimit(userB)).toBe(true);
  });
});
