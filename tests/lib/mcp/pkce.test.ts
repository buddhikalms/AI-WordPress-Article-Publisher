import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { isValidCodeVerifier, verifyPkce } from "@/lib/mcp/pkce";

const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

describe("verifyPkce", () => {
  it("accepts a correct S256 challenge", () => {
    expect(verifyPkce(codeVerifier, codeChallenge, "S256")).toBe(true);
  });

  it("rejects a tampered code_verifier", () => {
    expect(verifyPkce("tamperedVerifierValueThatIsLongEnough123456", codeChallenge, "S256")).toBe(
      false,
    );
  });

  it("rejects a mismatched challenge", () => {
    expect(verifyPkce(codeVerifier, "not-the-right-challenge", "S256")).toBe(false);
  });

  it("rejects any method other than S256", () => {
    expect(verifyPkce(codeVerifier, codeChallenge, "plain")).toBe(false);
  });

  it("rejects a malformed code_verifier", () => {
    expect(isValidCodeVerifier("too-short")).toBe(false);
    expect(isValidCodeVerifier(codeVerifier)).toBe(true);
  });
});
