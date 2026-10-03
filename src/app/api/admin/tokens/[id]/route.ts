import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/** Revoke a token. Revocation is immediate and irreversible. */
export async function PATCH(
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
  const token = rows[0];
  if (!token) return json(404, { ok: false, error: "Token not found." });
  if (token.revokedAt) return json(409, { ok: false, error: "Token is already revoked." });

  await db
    .update(applicationAccessTokens)
    .set({ revokedAt: new Date() })
    .where(eq(applicationAccessTokens.id, id));

  await audit({
    adminId: ctx.admin.id,
    action: "token.revoked",
    entityType: "access_token",
    entityId: id,
    metadata: { label: token.label },
    ip: clientIp(req),
  });

  return json(200, { ok: true });
}
