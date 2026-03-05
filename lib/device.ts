import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";

export const DEVICE_COOKIE_NAME = "device_id";

const cookieValueFromHeader = (cookieHeader: string | null, key: string) => {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === key) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
};

export const getDeviceIdFromRequest = (request: Request) => {
  const cookieHeader = request.headers.get("cookie");
  return cookieValueFromHeader(cookieHeader, DEVICE_COOKIE_NAME);
};

export const enforceSingleDeviceAccount = async (params: {
  userId: string;
  deviceId: string | null;
  userAgent?: string | null;
}) => {
  const deviceId = params.deviceId?.trim();
  if (!deviceId) {
    throw new HttpError(400, "Device identifier is missing.");
  }

  await prisma.$transaction(async (tx) => {
    const userBinding = await tx.deviceRegistration.findUnique({
      where: { userId: params.userId },
    });

    if (userBinding && userBinding.deviceId !== deviceId) {
      throw new HttpError(
        403,
        "This account is already bound to another device.",
      );
    }

    const deviceBinding = await tx.deviceRegistration.findUnique({
      where: { deviceId },
    });

    if (deviceBinding && deviceBinding.userId !== params.userId) {
      throw new HttpError(
        403,
        "This device is already linked to a different account.",
      );
    }

    if (!deviceBinding) {
      await tx.deviceRegistration.create({
        data: {
          userId: params.userId,
          deviceId,
          userAgent: params.userAgent?.slice(0, 500) || null,
        },
      });
      return;
    }

    await tx.deviceRegistration.update({
      where: { id: deviceBinding.id },
      data: {
        userAgent: params.userAgent?.slice(0, 500) || deviceBinding.userAgent,
      },
    });
  });
};