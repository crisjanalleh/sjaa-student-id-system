import { NextResponse } from "next/server";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { clientIp, readJsonObjectBounded } from "@/lib/request";
import { ensureSchoolSettingsTable } from "@/lib/school";
import { cleanText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return response(403, { ok: false, error: "Security validation failed." });

  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectBounded(req, 4 * 1024);
  } catch {
    return response(400, { ok: false, error: "Could not read the location update." });
  }

  const address = cleanText(body.address).replace(/\s+/g, " ").slice(0, 200);
  if (address.length < 8) {
    return response(422, { ok: false, error: "Enter the complete school address (at least 8 characters)." });
  }

  await ensureSchoolSettingsTable();
  await db.transaction(async (tx) => {
    await tx
      .insert(schoolSettings)
      .values({ id: 1, address, updatedByAdminId: ctx.admin.id, updatedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { address, updatedByAdminId: ctx.admin.id, updatedAt: new Date() } });
    await audit(
      {
        adminId: ctx.admin.id,
        action: "admin.school_location_updated",
        entityType: "admin",
        entityId: ctx.admin.id,
        metadata: { address },
        ip: clientIp(req),
      },
      tx,
    );
  });

  return response(200, { ok: true, address });
}
