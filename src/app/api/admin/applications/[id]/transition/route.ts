import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { studentApplications } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { deliverNotification, queueNotification } from "@/lib/mailer";
import { clientIp } from "@/lib/request";
import { cleanText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "approve" | "reject" | "claim";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Server-side state machine enforcement. Every transition:
 *  - requires an authenticated admin + session-bound CSRF token;
 *  - locks the row (SELECT … FOR UPDATE) to prevent concurrent double-actions;
 *  - verifies the CURRENT status before mutating;
 *  - commits the business change first, then handles notifications.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) {
    return json(403, { ok: false, error: "Security validation failed." });
  }

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid application id." });

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }
  const action = body.action as Action;

  const ip = clientIp(req);

  if (action === "approve") {
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(studentApplications)
        .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
        .for("update")
        .limit(1);
      const app = rows[0];
      if (!app) return { status: 404 as const };
      if (app.status !== "pending") return { status: 409 as const, app };

      await tx
        .update(studentApplications)
        .set({
          status: "approved",
          reviewedAt: new Date(),
          approvedAt: new Date(),
          reviewedByAdminId: ctx.admin.id,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(studentApplications.id, id));
      await audit(
        {
          adminId: ctx.admin.id,
          action: "application.approved",
          entityType: "application",
          entityId: app.id,
          metadata: { code: app.applicationCode },
          ip,
        },
        tx,
      );
      return { status: 200 as const, app };
    });
    if (result.status === 404) return json(404, { ok: false, error: "Application not found." });
    if (result.status === 409) {
      return json(409, { ok: false, error: `Only pending applications can be approved (current status: ${result.app?.status}).` });
    }
    return json(200, { ok: true, status: "approved" });
  }

  if (action === "reject") {
    const reason = cleanText(body.reason).slice(0, 500);
    if (reason.length < 4) {
      return json(422, { ok: false, error: "A rejection reason is required (minimum 4 characters)." });
    }

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(studentApplications)
        .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
        .for("update")
        .limit(1);
      const app = rows[0];
      if (!app) return { status: 404 as const };
      if (app.status !== "pending") return { status: 409 as const, app };

      await tx
        .update(studentApplications)
        .set({
          status: "rejected",
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByAdminId: ctx.admin.id,
          updatedAt: new Date(),
        })
        .where(eq(studentApplications.id, id));
      await audit(
        {
          adminId: ctx.admin.id,
          action: "application.rejected",
          entityType: "application",
          entityId: app.id,
          metadata: { code: app.applicationCode, reason: reason.slice(0, 160) },
          ip,
        },
        tx,
      );
      const notificationId = await queueNotification({
        applicationId: app.id,
        type: "rejection_notice",
        recipientEmail: app.email || "",
      }, tx);
      return { status: 200 as const, notificationId };
    });
    if (result.status === 404) return json(404, { ok: false, error: "Application not found." });
    if (result.status === 409) {
      return json(409, { ok: false, error: `Only pending applications can be rejected (current status: ${result.app?.status}).` });
    }

    // Delivery happens after the state, audit event, and notification row
    // have committed together; SMTP failures remain visible for retry.
    await deliverNotification(result.notificationId);

    return json(200, { ok: true, status: "rejected" });
  }

  if (action === "claim") {
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(studentApplications)
        .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
        .for("update")
        .limit(1);
      const app = rows[0];
      if (!app) return { status: 404 as const };
      if (app.status !== "printed") return { status: 409 as const, app };

      await tx
        .update(studentApplications)
        .set({
          status: "claimed",
          claimedAt: new Date(),
          claimedByAdminId: ctx.admin.id,
          updatedAt: new Date(),
        })
        .where(eq(studentApplications.id, id));
      await audit(
        {
          adminId: ctx.admin.id,
          action: "application.claimed",
          entityType: "application",
          entityId: app.id,
          metadata: { code: app.applicationCode },
          ip,
        },
        tx,
      );
      return { status: 200 as const, app };
    });
    if (result.status === 404) return json(404, { ok: false, error: "Application not found." });
    if (result.status === 409) {
      return json(409, { ok: false, error: `Only printed IDs can be marked claimed (current status: ${result.app?.status}).` });
    }
    return json(200, { ok: true, status: "claimed" });
  }

  return json(422, { ok: false, error: "Unsupported action." });
}
