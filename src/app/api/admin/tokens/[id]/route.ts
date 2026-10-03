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

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(applicationAccessTokens)
      .where(eq(applicationAccessTokens.id, id))
      .for("update")
      .limit(1);
    const token = rows[0];
    if (!token) return { status: 404 as const };
    if (token.revokedAt) return { status: 409 as const };

    await tx
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
    }, tx);
    return { status: 200 as const };
  });

  if (result.status === 404) return json(404, { ok: false, error: "Token not found." });
  if (result.status === 409) return json(409, { ok: false, error: "Token is already revoked." });
  return json(200, { ok: true });
}
