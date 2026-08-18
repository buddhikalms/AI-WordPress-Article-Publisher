import { describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wordPressCredential: { findFirst },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decryptSecret: (value: string) => `decrypted:${value}`,
}));

const { getUserWordPressConfig } = await import("@/lib/user-wordpress");

describe("getUserWordPressConfig ownership guard", () => {
  it("scopes the lookup to the requesting user and the requested site", async () => {
    findFirst.mockResolvedValueOnce({
      id: "site-1",
      name: "My Site",
      baseUrl: "https://example.com",
      username: "admin",
      appPasswordEncrypted: "enc",
    });

    await getUserWordPressConfig("user-1", "site-1");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "site-1", userId: "user-1" },
      }),
    );
  });

  it("throws instead of returning another user's site when none match", async () => {
    findFirst.mockResolvedValueOnce(null);

    await expect(getUserWordPressConfig("user-1", "someone-elses-site")).rejects.toThrow(
      /No WordPress site is configured/,
    );
  });
});
