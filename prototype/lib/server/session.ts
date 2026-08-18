/**
 * Signed session cookie (JWT via jose). The session is server-issued and
 * server-verified — RBAC is authoritative on the server, never the UI.
 * Phase 2 replaces the dev login that issues this with Google OAuth (Auth.js),
 * but the cookie/verify mechanism and `getActor` resolution stay the same.
 */
import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "./env";
import { prisma } from "./db";
import type { AppUser } from "../contract/types";

export const SESSION_COOKIE = "hitopia_session";

function key() {
  return new TextEncoder().encode(getSecret("SESSION_SECRET"));
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/** Resolve the authenticated AppUser from a session token, or null. */
export async function actorFromToken(token: string | undefined): Promise<AppUser | null> {
  const userId = await verifySession(token);
  if (!userId) return null;
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    omit: { password_hash: true },
  });
  if (!user || user.status !== "active") return null;
  return user as unknown as AppUser;
}
