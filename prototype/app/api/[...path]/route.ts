/**
 * Single catch-all route handler for the entire foundation contract API.
 * Auth endpoints set/clear the session cookie here; everything else flows to the
 * Prisma-backed dispatcher in lib/server/handler.ts. Node runtime (Prisma + pg).
 */
import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/server/handler";
import { actorFromToken, signSession, SESSION_COOKIE } from "@/lib/server/session";
import { verifyPassword, publicUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { HttpError, err } from "@/lib/server/http";
import { logAudit } from "@/lib/server/audit";
import type { AppUser } from "@/lib/contract/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };

async function dispatch(method: string, req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  const rawPath = "/" + path.join("/");
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  let body: unknown = undefined;
  if (method !== "GET" && method !== "DELETE") {
    body = await req.json().catch(() => undefined);
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  // --- auth (cookie-managing) endpoints ---
  if (rawPath === "/auth/login" && method === "POST") {
    const b = body as { email?: string; password?: string } | undefined;
    const email = b?.email?.toLowerCase().trim();
    const user = email ? await prisma.appUser.findUnique({ where: { email } }) : null;
    const ok =
      !!user &&
      user.status === "active" &&
      !!user.password_hash &&
      !!b?.password &&
      (await verifyPassword(b.password, user.password_hash));
    if (!user || !ok) {
      // Same message for unknown email and wrong password (no account enumeration).
      return NextResponse.json(err("INVALID_LOGIN", "Invalid email or password."), { status: 401 });
    }
    const jwt = await signSession(user.id);
    const res = NextResponse.json({ token: jwt, user: publicUser(user) });
    res.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    await logAudit(user as unknown as AppUser, "auth.login", "app_user", user.id, { method: "password" });
    return res;
  }
  if (rawPath === "/auth/logout" && method === "POST") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  const actor = await actorFromToken(token);
  try {
    const result = await handle(method, rawPath, query, body, actor);
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json(err(e.code, e.message, e.details), { status: e.status });
    }
    // Never leak internals to the client (security). Log server-side only.
    console.error("API error:", e);
    return NextResponse.json(err("INTERNAL", "Internal server error."), { status: 500 });
  }
}

export const GET = (req: NextRequest, ctx: Ctx) => dispatch("GET", req, ctx);
export const POST = (req: NextRequest, ctx: Ctx) => dispatch("POST", req, ctx);
export const PUT = (req: NextRequest, ctx: Ctx) => dispatch("PUT", req, ctx);
export const PATCH = (req: NextRequest, ctx: Ctx) => dispatch("PATCH", req, ctx);
export const DELETE = (req: NextRequest, ctx: Ctx) => dispatch("DELETE", req, ctx);
