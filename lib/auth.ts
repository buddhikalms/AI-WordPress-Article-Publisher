import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

type AppUserSessionFields = {
  id: string;
  role: "USER" | "ADMIN";
  emailVerified: string | null;
};

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const adminEmailSet = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;

      if (!email || !password) {
        throw new Error("Email and password are required.");
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        throw new Error("Invalid email or password.");
      }

      const isValid = await compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error("Invalid email or password.");
      }

      if (!user.emailVerified) {
        throw new Error("Please verify your email before signing in.");
      }

      const authUser: User = {
        id: user.id,
        name: user.name,
        email: user.email ?? email,
        image: user.image,
        role: user.role,
        emailVerified: user.emailVerified.toISOString(),
      };

      return authUser;
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return true;
      }

      const normalizedEmail = user.email.toLowerCase();
      const isGoogle = account?.provider === "google";

      const existing = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: user.name || null,
            image: user.image || null,
            ...(isGoogle ? { emailVerified: new Date() } : {}),
            ...(adminEmailSet.has(normalizedEmail) ? { role: "ADMIN" } : {}),
          },
        });
      } else {
        await prisma.user.update({
          where: {
            id: existing.id,
          },
          data: {
            ...(user.name ? { name: user.name } : {}),
            ...(user.image ? { image: user.image } : {}),
            ...(isGoogle ? { emailVerified: new Date() } : {}),
            ...(adminEmailSet.has(normalizedEmail) ? { role: "ADMIN" } : {}),
          },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      const userEmail =
        (user?.email || token.email)?.toString().trim().toLowerCase() || null;

      if (userEmail) {
        const dbByEmail = await prisma.user.findUnique({
          where: {
            email: userEmail,
          },
          select: {
            id: true,
          },
        });

        if (dbByEmail?.id) {
          token.sub = dbByEmail.id;
        }
      }

      if (user?.id) {
        token.sub = user.id;
      }

      if (!token.sub) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          id: true,
          role: true,
          emailVerified: true,
        },
      });

      if (!dbUser) {
        return token;
      }

      token.role = dbUser.role;
      token.emailVerified = dbUser.emailVerified
        ? dbUser.emailVerified.toISOString()
        : null;

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        const fields: AppUserSessionFields = {
          id: token.sub,
          role: (token.role as "USER" | "ADMIN") || "USER",
          emailVerified: (token.emailVerified as string | null) || null,
        };

        session.user.id = fields.id;
        session.user.role = fields.role;
        session.user.emailVerified = fields.emailVerified;
      }

      return session;
    },
  },
};
