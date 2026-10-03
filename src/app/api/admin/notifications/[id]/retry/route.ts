import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { deliverNotification } from "@/lib/mailer";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Controlled retry for failed notifications. Re-sends only — it never
 * re-runs business state transitions, and the retry itself is audited.
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
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid notification id." });

  const claim = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.id, id))
      .for("update")
      .limit(1);
    const log = rows[0];
    if (!log) return { status: "missing" as const };
    if (log.sentStatus === "sent") return { status: "sent" as const, log };
    if (
      log.sentStatus === "pending" &&
      log.updatedAt.getTime() > Date.now() - 15 * 60 * 1000
    ) {
      return { status: "pending" as const, log };
    }

    await tx
      .update(notificationLogs)
      .set({ sentStatus: "pending", error: null, updatedAt: new Date() })
      .where(eq(notificationLogs.id, id));
    return { status: "claimed" as const, log };
  });
  if (claim.status === "missing") return json(404, { ok: false, error: "Notification not found." });
  const log = claim.log;
  if (claim.status === "sent") {
    return json(409, { ok: false, error: "This notification was already sent." });
  }
  if (claim.status === "pending") {
    return json(409, { ok: false, error: "This notification is already queued or being sent. Refresh in a moment before retrying." });
  }

  const result = await deliverNotification(id);

  await audit({
    adminId: ctx.admin.id,
    action: "notification.retried",
    entityType: "notification",
    entityId: id,
    metadata: { type: log.notificationType, result: result.ok ? "sent" : "failed" },
    ip: clientIp(req),
  });

  return json(result.ok ? 200 : 502, {
    ok: result.ok,
    delivered: result.ok,
    error: result.error || null,
  });
}
