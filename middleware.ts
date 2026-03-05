import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEVICE_COOKIE_NAME = "device_id";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets")
  ) {
    return NextResponse.next();
  }

  const existing = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
  if (existing) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: crypto.randomUUID(),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export const config = {
  matcher: ["/:path*"],
};