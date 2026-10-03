import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { audit } from "@/lib/audit";
import {
  ADMIN_COOKIE,
  cookieBase,
  createAdminSession,
  destroyAdminSession,
} from "@/lib/auth";
import { config } from "@/lib/config";
import { hashIp, sha256Hex, verifyPassword } from "@/lib/crypto";
import { rateLimitHit, resetRateLimit } from "@/lib/rate-limit";
import { clientIp, userAgent } from "@/lib/request";
import { cleanText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_FAILURE = "Invalid username or password.";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ipKey = `login:ip:${hashIp(ip)}`;

  // Per-IP throttle
  const ipLimit = await rateLimitHit(ipKey, 10, 900);
  if (!ipLimit.allowed) {
    return json(429, { ok: false, error: "Too many sign-in attempts. Please try again later." });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }

  const username = cleanText(body.username).slice(0, 64);
  const password = typeof body.password === "string" ? body.password.slice(0, 128) : "";
  if (!username || !password) {
    return json(422, { ok: false, error: GENERIC_FAILURE });
  }

  // Per-account throttle (keyed by hash — usernames are not leaked into keys)
  const userKey = `login:user:${sha256Hex(username.toLowerCase()).slice(0, 24)}`;
  const userLimit = await rateLimitHit(userKey, 5, 900);
  if (!userLimit.allowed) {
    return json(429, { ok: false, error: "Too many sign-in attempts. Please try again later." });
  }

  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1);
  const admin = rows[0];

  const passwordOk = admin ? verifyPassword(password, admin.passwordHash) : false;
  if (!admin || !admin.isActive || !passwordOk) {
    await audit({
      action: "auth.login_failed",
      entityType: "admin",
      metadata: { username },
      ip,
    });
    return json(401, { ok: false, error: GENERIC_FAILURE });
  }

  // Session fixation defense: discard any current session before issuing a
  // brand-new, server-side session with a fresh CSRF token.
  await destroyAdminSession();
  const token = await createAdminSession(admin.id, req, ip, userAgent(req));

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, admin.id));
  await resetRateLimit(userKey);
  await audit({
    adminId: admin.id,
    action: "auth.login_success",
    entityType: "admin",
    entityId: admin.id,
    ip,
  });

  const res = NextResponse.json({ ok: true, redirect: "/admin" }, { status: 200 });
  res.cookies.set(ADMIN_COOKIE, token, {
    ...cookieBase(),
    maxAge: config.sessionAbsoluteHours * 3600,
  });
  return res;
}
