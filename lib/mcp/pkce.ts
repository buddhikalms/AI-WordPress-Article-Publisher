import { createHash } from "crypto";

const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export const isValidCodeVerifier = (value: string) =>
  CODE_VERIFIER_PATTERN.test(value);

export const verifyPkce = (
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: string,
) => {
  if (codeChallengeMethod !== "S256") {
    return false;
  }
  if (!isValidCodeVerifier(codeVerifier)) {
    return false;
  }
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
};
