import { and, asc, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  printBatchItems,
  printBatches,
  studentApplications,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { newBatchCode } from "@/lib/crypto";
import {
  clientIp,
  readJsonObjectBounded,
  RequestBodyTooLargeError,
} from "@/lib/request";
import { getTemplateConfig, templateSnapshot } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Transaction-backed batch print engine.
 *  1. Validate the selected ids;
 *  2. lock the rows (SELECT … FOR UPDATE) so two admin sessions cannot print
 *     the same approved record concurrently;
 *  3. re-verify every record is STILL approved inside the lock;
 *  4. capture the template version + configuration snapshot;
 *  5. create the batch + items atomically;
 *  6. leave applications approved until an administrator confirms printing.
 *
 * Reprint safety: print_batch_items.application_id is UNIQUE, and the status
 * re-check rejects anything that is no longer `approved` — a page refresh can
 * never print a record twice.
 */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectBounded(req, 32 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json(413, { ok: false, error: "Batch request is too large." });
    }
    return json(400, { ok: false, error: "Malformed request." });
  }

  const idsRaw = Array.isArray(body.ids) ? body.ids : [];
  if (idsRaw.length > 100) {
    return json(422, { ok: false, error: "A single batch may contain at most 100 records." });
  }
  if (!idsRaw.every((value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0)) {
    return json(422, { ok: false, error: "Each selected application must have a valid record ID. Refresh the list and try again." });
  }
  const ids = [...new Set(idsRaw as number[])].sort((a, b) => a - b);
  if (ids.length === 0) return json(422, { ok: false, error: "Select at least one approved application." });
  if (ids.length > 100) return json(422, { ok: false, error: "A single batch may contain at most 100 records." });

  const ip = clientIp(req);

  const txResult = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(studentApplications)
      .where(and(inArray(studentApplications.id, ids), isNull(studentApplications.deletedAt)))
      .orderBy(asc(studentApplications.id))
      .for("update");

    if (rows.length !== ids.length) {
      return { error: "Some selected applications no longer exist. Refresh the list and try again." };
    }
    const notApproved = rows.filter((r) => r.status !== "approved");
    if (notApproved.length > 0) {
      return {
        error: `Only approved records can be printed. Not eligible: ${notApproved
          .map((r) => r.applicationCode)
          .slice(0, 5)
          .join(", ")}${notApproved.length > 5 ? "…" : ""}.`,
      };
    }

    const alreadyPrinted = await tx
      .select({ applicationId: printBatchItems.applicationId })
      .from(printBatchItems)
      .where(inArray(printBatchItems.applicationId, ids));
    if (alreadyPrinted.length > 0) {
      return { error: "One or more records were already printed in a previous batch." };
    }

    const template = await getTemplateConfig(tx);
    const batchCode = newBatchCode();
    const batchRows = await tx
      .insert(printBatches)
      .values({
        batchCode,
        createdByAdminId: ctx.admin.id,
        templateVersion: template.version,
        templateSnapshot: templateSnapshot(template),
        cardCount: rows.length,
        printedAt: null,
      })
      .$returningId();
    const batch = batchRows[0];

    await tx.insert(printBatchItems).values(
      rows.map((r) => ({
        batchId: batch.id,
        applicationId: r.id,
        templateVersion: template.version,
      })),
    );

    await audit(
      {
        adminId: ctx.admin.id,
        action: "batch.created",
        entityType: "print_batch",
        entityId: batch.id,
        metadata: {
          batchCode,
          cardCount: rows.length,
          templateVersion: template.version,
        },
        ip,
      },
      tx,
    );

    return { batchId: batch.id };
  });

  if ("error" in txResult) {
    return json(409, { ok: false, error: txResult.error });
  }

  return json(201, {
    ok: true,
    batchId: txResult.batchId,
  });
}
