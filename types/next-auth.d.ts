import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "USER" | "ADMIN";
      emailVerified: string | null;
    };
  }

  interface User {
    role?: "USER" | "ADMIN";
    emailVerified?: string | Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "USER" | "ADMIN";
    emailVerified?: string | null;
  }
}