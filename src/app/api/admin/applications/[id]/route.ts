import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { studentApplications } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { hasErrors, validateApplicationFields } from "@/lib/validate";
import { isDuplicateEntry } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

async function loadApplication(id: number) {
  const rows = await db
    .select()
    .from(studentApplications)
    .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
    .limit(1);
  return rows[0] || null;
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

  const app = await loadApplication(id);
  if (!app) return json(404, { ok: false, error: "Application not found." });
  if (app.status !== "pending" && app.status !== "rejected") {
    return json(409, {
      ok: false,
      error: `Records with status "${app.status}" can no longer be edited.`,
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Malformed request." });
  }

  const { values, errors } = validateApplicationFields({ ...body, consent: true });
  delete errors.consent;
  if (hasErrors(errors)) {
    return json(422, { ok: false, error: "Please correct the highlighted fields.", errors });
  }

  try {
    await db
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
        bloodType: values.bloodType,
        updatedAt: new Date(),
      })
      .where(eq(studentApplications.id, id));
  } catch (err) {
    if (isDuplicateEntry(err)) {
      return json(409, {
        ok: false,
        error: "Another application already uses this Student ID/LRN or email address.",
      });
    }
    throw err;
  }

  await audit({
    adminId: ctx.admin.id,
    action: "application.edited",
    entityType: "application",
    entityId: id,
    metadata: { code: app.applicationCode },
    ip: clientIp(req),
  });

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

  const app = await loadApplication(id);
  if (!app) return json(404, { ok: false, error: "Application not found." });
  if (app.status === "claimed") {
    return json(409, { ok: false, error: "Claimed records cannot be deleted." });
  }

  await db
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
  });

  return json(200, { ok: true });
}
