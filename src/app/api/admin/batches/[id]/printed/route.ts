import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  printBatchItems,
  printBatches,
  studentApplications,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { deliverNotification, queueNotification } from "@/lib/mailer";
import {
  clientIp,
  readJsonObjectBounded,
  RequestBodyTooLargeError,
} from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

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
  const batchId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return json(400, { ok: false, error: "Invalid print batch." });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObjectBounded(req, 16 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json(413, { ok: false, error: "Print confirmation request is too large." });
    }
    return json(400, { ok: false, error: "Confirm the batch printing action and try again." });
  }
  if (body.confirmedPrinted !== true) {
    return json(422, {
      ok: false,
      error: "Confirm that all cards in the batch were printed and are ready for collection.",
    });
  }

  const result = await db.transaction(async (tx) => {
    const batches = await tx
      .select()
      .from(printBatches)
      .where(eq(printBatches.id, batchId))
      .for("update")
      .limit(1);
    const batch = batches[0];
    if (!batch) return { status: 404 as const };
    if (batch.printedAt) return { status: 409 as const, reason: "already-printed" as const };

    const items = await tx
      .select({ app: studentApplications })
      .from(printBatchItems)
      .innerJoin(
        studentApplications,
        eq(studentApplications.id, printBatchItems.applicationId),
      )
      .where(eq(printBatchItems.batchId, batchId))
      .orderBy(printBatchItems.id)
      .for("update");
    if (items.length === 0) return { status: 409 as const, reason: "empty" as const };
    if (items.some(({ app }) => app.deletedAt || app.status !== "approved")) {
      return { status: 409 as const, reason: "changed" as const };
    }

    const now = new Date();
    const applicationIds = items.map(({ app }) => app.id);
    await tx
      .update(studentApplications)
      .set({
        status: "printed",
        printedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(studentApplications.id, applicationIds),
          eq(studentApplications.status, "approved"),
          isNull(studentApplications.deletedAt),
        ),
      );
    await tx
      .update(printBatches)
      .set({ printedAt: now })
      .where(and(eq(printBatches.id, batchId), isNull(printBatches.printedAt)));

    const notificationIds: number[] = [];
    for (const { app } of items) {
      notificationIds.push(
        await queueNotification(
          {
            applicationId: app.id,
            type: "ready_for_claiming",
            recipientEmail: app.email || "",
          },
          tx,
        ),
      );
    }

    await audit(
      {
        adminId: ctx.admin.id,
        action: "batch.printed",
        entityType: "print_batch",
        entityId: batch.id,
        metadata: { batchCode: batch.batchCode, cardCount: items.length },
        ip: clientIp(req),
      },
      tx,
    );
    return { status: 200 as const, notificationIds };
  });

  if (result.status === 404) {
    return json(404, { ok: false, error: "Print batch not found." });
  }
  if (result.status === 409) {
    const message =
      result.reason === "already-printed"
        ? "This batch has already been confirmed as printed. Refresh the page to see its current status."
        : result.reason === "empty"
          ? "This batch has no cards to mark as printed."
          : "One or more applications changed after this batch was created. Refresh the batch and review the records.";
    return json(409, { ok: false, error: message });
  }

  const deliveryResults: PromiseSettledResult<{ ok: boolean }>[] = [];
  let nextNotification = 0;
  const workerCount = Math.min(5, result.notificationIds.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextNotification < result.notificationIds.length) {
        const notificationId = result.notificationIds[nextNotification++];
        deliveryResults.push(
          await Promise.resolve()
            .then(() => deliverNotification(notificationId))
            .then(
              (delivery) => ({ status: "fulfilled", value: delivery }) as const,
              (reason: unknown) => ({ status: "rejected", reason }) as const,
            ),
        );
      }
    }),
  );
  const notificationAttention = deliveryResults.some(
    (delivery) => delivery.status === "rejected" || !delivery.value.ok,
  );
  return json(200, { ok: true, notificationAttention });
}
