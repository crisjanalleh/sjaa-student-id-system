import { NextResponse } from "next/server";
import { db } from "@/db";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { config } from "@/lib/config";
import { clientIp } from "@/lib/request";
import { createAccessToken } from "@/lib/tokens";
import { cleanText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Creates a new application access token. The raw token is returned to the
 * authenticated administrator and retained only as authenticated ciphertext
 * for later recovery; token validation continues to use the SHA-256 hash.
 */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  let body: { label?: unknown; expiresAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }

  const label = cleanText(body.label).slice(0, 120);
  if (label.length < 3) {
    return json(422, { ok: false, error: "A campaign label is required (e.g. SY 2026-2027)." });
  }

  let expiresAt: Date;
  if (body.expiresAt) {
    const parsed = new Date(String(body.expiresAt));
    if (Number.isNaN(parsed.getTime())) {
      return json(422, { ok: false, error: "Invalid expiration date." });
    }
    if (parsed.getTime() < Date.now() + 5 * 60 * 1000) {
      return json(422, { ok: false, error: "Expiration must be at least 5 minutes in the future." });
    }
    expiresAt = parsed;
  } else {
    expiresAt = new Date(Date.now() + config.publicTokenDefaultTtlDays * 24 * 60 * 60 * 1000);
  }

  const { raw, id } = await db.transaction(async (tx) => {
    const token = await createAccessToken({
      label,
      expiresAt,
      createdByAdminId: ctx.admin.id,
    }, tx);
    await audit({
      adminId: ctx.admin.id,
      action: "token.created",
      entityType: "access_token",
      entityId: token.id,
      metadata: { label, expiresAt: expiresAt.toISOString() },
      ip: clientIp(req),
    }, tx);
    return token;
  });

  return json(201, {
    ok: true,
    id,
    rawToken: raw,
    url: `${config.appUrl}/?access_token=${raw}`,
  });
}
