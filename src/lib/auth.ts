import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  adminSessions,
  adminUsers,
  applicationAccessTokens,
  formSessions,
  type AdminUser,
} from "@/db/schema";
import { config } from "@/lib/config";
import { randomToken, safeEqual, sha256Hex } from "@/lib/crypto";

export const ADMIN_COOKIE = "sjaa_admin";
export const FORM_COOKIE = "sjaa_apply";

function cookieBase(secure: boolean = config.secureCookies) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
}

let lastSessionCleanupAt = 0;

function cleanupExpiredSessionsOccasionally(): void {
  const now = Date.now();
  if (now - lastSessionCleanupAt < 60 * 60 * 1000) return;
  lastSessionCleanupAt = now;

  void Promise.all([
    db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date(now))),
    db.delete(formSessions).where(lt(formSessions.expiresAt, new Date(now))),
  ]).catch((error: unknown) => {
    console.error(
      "Expired session cleanup failed:",
      error instanceof Error ? error.message : error,
    );
  });
}


export type AdminContext = {
  admin: AdminUser;
  sessionId: number;
  csrfToken: string;
};

export async function createAdminSession(
  adminId: number,
  req: Request,
  ip: string,
  ua: string,
): Promise<string> {
  const token = randomToken(32);
  const csrf = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + config.sessionAbsoluteHours * 60 * 60 * 1000,
  );
  await db.insert(adminSessions).values({
    tokenHash: sha256Hex(token),
    adminUserId: adminId,
    csrfToken: csrf,
    ipHash: null,
    userAgent: ua.slice(0, 300),
    expiresAt,
    lastSeenAt: now,
  });
  cleanupExpiredSessionsOccasionally();
  void req;
  void ip;
  return token;
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const store = await cookies();
  const raw = store.get(ADMIN_COOKIE)?.value;
  if (!raw || raw.length < 20) return null;

  const rows = await db
    .select({ session: adminSessions, admin: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
    .where(
      and(
        eq(adminSessions.tokenHash, sha256Hex(raw)),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.admin.isActive) return null;

  const idleMs = config.sessionIdleMinutes * 60 * 1000;
  if (Date.now() - row.session.lastSeenAt.getTime() > idleMs) {
    // Idle timeout: invalidate server-side so the cookie alone is useless.
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.id, row.session.id));
    return null;
  }

  await db
    .update(adminSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(adminSessions.id, row.session.id));

  return {
    admin: row.admin,
    sessionId: row.session.id,
    csrfToken: row.session.csrfToken,
  };
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(ADMIN_COOKIE)?.value;
  if (raw) {
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, sha256Hex(raw)));
  }
}

export function setAdminCookie(token: string): void {
  // Used from route handlers only.
  void token;
}

export async function requireAdminApi(): Promise<
  { ctx: AdminContext; error?: never } | { ctx?: never; error: NextResponse }
> {
  const ctx = await getAdminContext();
  if (!ctx) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      ),
    };
  }
  return { ctx };
}
export function csrfOk(req: Request, expectedToken: string): boolean {
  const header = req.headers.get("x-csrf-token") || "";
  if (!header || header.length > 128) return false;
  return safeEqual(header, expectedToken);
}

export type FormContext = {
  formSessionId: number;
  accessTokenId: number;
  accessTokenLabel: string;
  csrfToken: string;
  tokenExpiresAt: Date | null;
  sessionCreatedAt: Date;
};

/** A student's form stays open on their phone only while they keep using it. */
export const FORM_IDLE_MS = 30 * 60 * 1000;
const FORM_ABSOLUTE_MS = 4 * 60 * 60 * 1000;

function slidingExpiry(startedAt: number, tokenExpiresAt: Date | null): Date {
  const limit = Math.min(
    startedAt + FORM_ABSOLUTE_MS,
    tokenExpiresAt ? tokenExpiresAt.getTime() : Infinity,
  );
  return new Date(Math.min(Date.now() + FORM_IDLE_MS, limit));
}

export async function createFormSession(
  accessTokenId: number,
  tokenExpiresAt: Date | null,
  ipHash: string,
): Promise<{ raw: string; maxAgeSeconds: number }> {
  const raw = randomToken(32);
  const csrf = randomToken(32);
  const now = Date.now();
  const expiresAt = new Date(Math.max(now + 60 * 1000, slidingExpiry(now, tokenExpiresAt).getTime()));
  await db.insert(formSessions).values({
    tokenHash: sha256Hex(raw),
    accessTokenId,
    csrfToken: csrf,
    ipHash,
    expiresAt,
  });
  cleanupExpiredSessionsOccasionally();
  // The cookie outlives the idle window; the database row is what enforces the 30-minute idle limit.
  const cookieMs = Math.min(FORM_ABSOLUTE_MS, tokenExpiresAt ? Math.max(60_000, tokenExpiresAt.getTime() - now) : Infinity);
  return { raw, maxAgeSeconds: Math.floor(cookieMs / 1000) };
}

/** Records student activity, pushing the idle expiry forward. Returns false once the session can no longer be extended. */
export async function touchFormSession(ctx: FormContext): Promise<boolean> {
  const expiresAt = slidingExpiry(ctx.sessionCreatedAt.getTime(), ctx.tokenExpiresAt);
  if (expiresAt.getTime() <= Date.now()) return false;
  await db.update(formSessions).set({ expiresAt }).where(eq(formSessions.id, ctx.formSessionId));
  return true;
}

export async function getFormContext(): Promise<FormContext | null> {
  const store = await cookies();
  const raw = store.get(FORM_COOKIE)?.value;
  if (!raw || raw.length < 20) return null;

  const rows = await db
    .select({ fs: formSessions, token: applicationAccessTokens })
    .from(formSessions)
    .innerJoin(
      applicationAccessTokens,
      eq(applicationAccessTokens.id, formSessions.accessTokenId),
    )
    .where(
      and(
        eq(formSessions.tokenHash, sha256Hex(raw)),
        gt(formSessions.expiresAt, new Date()),
        isNull(applicationAccessTokens.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.token.expiresAt && row.token.expiresAt.getTime() < Date.now()) return null;

  return {
    formSessionId: row.fs.id,
    accessTokenId: row.token.id,
    accessTokenLabel: row.token.label,
    csrfToken: row.fs.csrfToken,
    tokenExpiresAt: row.token.expiresAt,
    sessionCreatedAt: row.fs.createdAt,
  };
}

export { cookieBase };
