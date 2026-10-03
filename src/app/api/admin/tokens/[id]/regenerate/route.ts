import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { config } from "@/lib/config";
import { clientIp } from "@/lib/request";
import { createAccessToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Rotates a token: the old token is revoked and a fresh token is issued for
 * the same campaign label. The new raw token is shown exactly once.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid token id." });

  const rows = await db
    .select()
    .from(applicationAccessTokens)
    .where(eq(applicationAccessTokens.id, id))
    .limit(1);
  const old = rows[0];
  if (!old) return json(404, { ok: false, error: "Token not found." });

  // Keep remaining lifetime when sensible; otherwise issue the default TTL.
  let expiresAt: Date;
  if (old.expiresAt && old.expiresAt.getTime() > Date.now() + 60 * 60 * 1000) {
    expiresAt = old.expiresAt;
  } else {
    expiresAt = new Date(Date.now() + config.publicTokenDefaultTtlDays * 24 * 60 * 60 * 1000);
  }

  if (!old.revokedAt) {
    await db
      .update(applicationAccessTokens)
      .set({ revokedAt: new Date() })
      .where(eq(applicationAccessTokens.id, old.id));
  }

  const { raw, id: newId } = await createAccessToken({
    label: old.label,
    expiresAt,
    createdByAdminId: ctx.admin.id,
  });

  await audit({
    adminId: ctx.admin.id,
    action: "token.regenerated",
    entityType: "access_token",
    entityId: newId,
    metadata: { label: old.label, revokedTokenId: old.id, expiresAt: expiresAt.toISOString() },
    ip: clientIp(req),
  });

  return json(201, {
    ok: true,
    id: newId,
    rawToken: raw,
    url: `${config.appUrl}/?access_token=${raw}`,
  });
}
