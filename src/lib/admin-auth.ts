import crypto from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const COOKIE_NAME = "kal_nidre_admin";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "change-me-before-launch";
}

function signature(payload: string): string {
  return crypto.createHmac("sha256", adminPassword()).update(payload).digest("hex");
}

export function createAdminToken(): string {
  const payload = `admin:${Date.now()}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminToken(token?: string): boolean {
  if (!token) {
    return false;
  }
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature || !payload.startsWith("admin:")) {
    return false;
  }
  const expected = signature(payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminToken(request.cookies.get(COOKIE_NAME)?.value);
}

export async function setAdminCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 10
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function isPasswordValid(password: string): boolean {
  const expected = adminPassword();
  try {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    return false;
  }
}
