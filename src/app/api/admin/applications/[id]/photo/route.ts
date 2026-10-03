import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { studentApplications } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { PhotoError, deletePhoto, processStudentPhoto, readPhoto } from "@/lib/photos";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Authenticated photo stream. Photos live outside the public web root under
 * random opaque keys; this endpoint is the ONLY way to view them, and it
 * requires an admin session. Cache is disabled to avoid leaking into
 * shared/browser caches.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  void ctx;

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid application id." });

  const rows = await db
    .select({ photoStorageKey: studentApplications.photoStorageKey })
    .from(studentApplications)
    .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
    .limit(1);
  const key = rows[0]?.photoStorageKey;
  if (!key) return json(404, { ok: false, error: "No photo on file." });

  try {
    const buffer = await readPhoto(key);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(buffer.length),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch {
    return json(404, { ok: false, error: "Photo file not found." });
  }
}

/**
 * Admin office replacement upload. Hard rule from the workflow: only a
 * REJECTED application may receive a replacement, and replacing returns it
 * to PENDING for re-review — never directly to approved.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: "Invalid application id." });

  const formData = await req.formData().catch(() => null);
  if (!formData) return json(400, { ok: false, error: "Malformed request." });
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return json(422, { ok: false, error: "A replacement photo file is required." });
  }
  if (photo.size > 5 * 1024 * 1024) {
    return json(413, { ok: false, error: "Replacement photo must be 5 MB or smaller." });
  }

  let processed: { storageKey: string; bytes: number };
  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    processed = await processStudentPhoto({ buffer, byteLength: buffer.length });
  } catch (err) {
    if (err instanceof PhotoError) return json(err.status, { ok: false, error: err.message });
    return json(422, { ok: false, error: "The photo could not be processed." });
  }

  const ip = clientIp(req);
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(studentApplications)
      .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
      .for("update")
      .limit(1);
    const app = rows[0];
    if (!app) return { status: 404 as const };
    if (app.status !== "rejected") return { status: 409 as const, app };

    await tx
      .update(studentApplications)
      .set({
        photoStorageKey: processed.storageKey,
        status: "pending",
        rejectionReason: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(studentApplications.id, id));

    await audit(
      {
        adminId: ctx.admin.id,
        action: "application.photo_replaced",
        entityType: "application",
        entityId: app.id,
        metadata: {
          code: app.applicationCode,
          previousReason: (app.rejectionReason || "").slice(0, 160),
        },
        ip,
      },
      tx,
    );
    return { status: 200 as const, app };
  });

  if (result.status === 404) {
    await deletePhoto(processed.storageKey);
    return json(404, { ok: false, error: "Application not found." });
  }
  if (result.status === 409) {
    await deletePhoto(processed.storageKey);
    return json(409, {
      ok: false,
      error: `Replacement photos are only accepted for rejected applications (current status: ${result.app?.status}).`,
    });
  }

  // Remove the old file only after the transaction commits.
  await deletePhoto(result.app?.photoStorageKey ?? null);
  return json(200, { ok: true, status: "pending" });
}
