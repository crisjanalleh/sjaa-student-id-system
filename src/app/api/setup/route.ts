import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { hashPassword, safeEqual } from "@/lib/crypto";
import { rateLimitHit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { cleanText } from "@/lib/validate";
import { hashIp } from "@/lib/crypto";
import { isDuplicateEntry } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,64}$/;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * One-time first-run initialization. Requires the deployment-provided
 * SETUP_SECRET, refuses to run after the first admin exists, throttles
 * attempts, and never logs the password or the secret.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);

  if (!config.setupSecret) {
    return json(403, {
      ok: false,
      error: "Browser setup is disabled. Use the server CLI: npx tsx scripts/create-admin.ts",
    });
  }

  const throttle = await rateLimitHit(`setup:${hashIp(ip)}`, 8, 3600);
  if (!throttle.allowed) {
    return json(429, { ok: false, error: "Too many setup attempts. Try again later." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }

  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!safeEqual(secret, config.setupSecret)) {
    return json(403, { ok: false, error: "Invalid setup secret." });
  }

  const username = cleanText(body.username).slice(0, 64);
  const fullName = cleanText(body.fullName).slice(0, 150);
  const email = cleanText(body.email).toLowerCase().slice(0, 255);
  const password = typeof body.password === "string" ? body.password : "";

  if (!USERNAME_RE.test(username)) {
    return json(422, { ok: false, error: "Username must be 3–64 characters (letters, numbers, dot, dash, underscore)." });
  }
  if (!fullName) return json(422, { ok: false, error: "Full name is required." });
  if (!EMAIL_RE.test(email)) return json(422, { ok: false, error: "Enter a valid email address." });
  if (password.length < 12) {
    return json(422, { ok: false, error: "Password must be at least 12 characters." });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adminUsers);
  if (Number(count) > 0) {
    return json(410, { ok: false, error: "Setup has already been completed and is disabled." });
  }

  try {
    const rows = await db
      .insert(adminUsers)
      .values({ username, fullName, email, passwordHash: hashPassword(password) })
      .$returningId();
    await audit({
      adminId: rows[0].id,
      action: "admin.setup_completed",
      entityType: "admin",
      entityId: rows[0].id,
      metadata: { method: "web" },
      ip,
    });
    return json(201, { ok: true });
  } catch (err) {
    if (isDuplicateEntry(err)) {
      return json(409, { ok: false, error: "Setup has already been completed." });
    }
    throw err;
  }
}
