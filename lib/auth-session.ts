import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const getCurrentSession = async () => getServerSession(authOptions);

export const requireSessionUser = async (request?: Request) => {
  void request;
  const session = await getCurrentSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new HttpError(401, "You must be signed in.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      tokenBalance: true,
    },
  });

  if (!user) {
    throw new HttpError(401, "User account no longer exists.");
  }

  return user;
};

export const requireVerifiedUser = async (request?: Request) => {
  const user = await requireSessionUser(request);

  if (!user.emailVerified) {
    throw new HttpError(403, "Please verify your email before using this feature.");
  }

  return user;
};

export const requireAdminUser = async (request?: Request) => {
  const user = await requireSessionUser(request);
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Admin access required.");
  }

  return user;
};