import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { printBatchItems, studentApplications } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import {
  clientIp,
  readJsonObjectBounded,
  RequestBodyTooLargeError,
} from "@/lib/request";
import { hasErrors, validateApplicationFields } from "@/lib/validate";
import { isDuplicateEntry } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/** Edit details — allowed only while the record is pending or rejected. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid application id." });

  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectBounded(req, 32 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json(413, { ok: false, error: "Application update is too large." });
    }
    return json(400, { ok: false, error: "Malformed request." });
  }

  const { values, errors } = validateApplicationFields({ ...body, consent: true });
  delete errors.consent;
  if (hasErrors(errors)) {
    return json(422, { ok: false, error: "Please correct the highlighted fields.", errors });
  }

  const ip = clientIp(req);
  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(studentApplications)
        .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
        .for("update")
        .limit(1);
      const app = rows[0];
      if (!app) return { status: 404 as const };
      if (app.status !== "pending" && app.status !== "rejected") {
        return { status: 409 as const, currentStatus: app.status };
      }

      await tx
        .update(studentApplications)
        .set({
          studentIdNumber: values.studentIdNumber,
          firstName: values.firstName,
          middleName: values.middleName,
          lastName: values.lastName,
          suffix: values.suffix,
          address: values.address,
          gradeLevel: values.gradeLevel,
          trackStrand: values.trackStrand,
          email: values.email,
          contactNumber: values.contactNumber,
          emergencyContactName: values.emergencyContactName,
          emergencyContactPhone: values.emergencyContactPhone,
          updatedAt: new Date(),
        })
        .where(eq(studentApplications.id, id));

      await audit({
        adminId: ctx.admin.id,
        action: "application.edited",
        entityType: "application",
        entityId: id,
        metadata: { code: app.applicationCode },
        ip,
      }, tx);
      return { status: 200 as const };
    });
    if (result.status === 404) return json(404, { ok: false, error: "Application not found." });
    if (result.status === 409) {
      return json(409, {
        ok: false,
        error: `Records with status "${result.currentStatus}" can no longer be edited.`,
      });
    }
  } catch (err) {
    if (isDuplicateEntry(err)) {
      return json(409, {
        ok: false,
        error: "Another application already uses this Student ID/LRN or email address.",
      });
    }
    throw err;
  }

  return json(200, { ok: true });
}

/** Soft delete — claimed records are protected; audit history is preserved. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid application id." });

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(studentApplications)
      .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
      .for("update")
      .limit(1);
    const app = rows[0];
    if (!app) return { status: 404 as const };
    if (app.status === "claimed") return { status: 409 as const };
    const batchItems = await tx
      .select({ id: printBatchItems.id })
      .from(printBatchItems)
      .where(eq(printBatchItems.applicationId, id))
      .limit(1);
    if (batchItems.length > 0) return { status: 409 as const, reason: "batched" as const };

    await tx
      .update(studentApplications)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(studentApplications.id, id));

    await audit({
      adminId: ctx.admin.id,
      action: "application.deleted",
      entityType: "application",
      entityId: id,
      metadata: { code: app.applicationCode, priorStatus: app.status },
      ip: clientIp(req),
    }, tx);
    return { status: 200 as const };
  });

  if (result.status === 404) return json(404, { ok: false, error: "Application not found." });
  if (result.status === 409) {
    return json(409, {
      ok: false,
      error: "Records in a print batch or already claimed cannot be deleted. Preserve the issuance history and contact an administrator if a correction is needed.",
    });
  }
  return json(200, { ok: true });
}
