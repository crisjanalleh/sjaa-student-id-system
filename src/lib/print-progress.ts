import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { printBatchItems, printBatches, printItemProgress, studentApplications } from "@/db/schema";
import { fullName } from "@/lib/format";
import {
  PRINT_SET_SIZE,
  type PrintDetail,
  type PrintItemRow,
  type PrintItemState,
  type PrintStatus,
  type PrintSummary,
} from "@/lib/print-progress-types";

// A run nobody confirmed (closed tab, crashed browser) stops counting as "printing" after this.
const STALE_MS = 20 * 60 * 1000;

let tableReady: Promise<unknown> | null = null;
// Created on first use so existing databases don't need a schema push.
function ensureTable() {
  tableReady ??= db
    .execute(sql`CREATE TABLE IF NOT EXISTS print_item_progress (
      batch_item_id INT NOT NULL PRIMARY KEY,
      batch_id INT NOT NULL,
      state VARCHAR(12) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX print_item_progress_batch_state_idx (batch_id, state),
      CONSTRAINT print_item_progress_item_fk FOREIGN KEY (batch_item_id) REFERENCES print_batch_items(id) ON DELETE CASCADE
    )`)
    .catch((error) => {
      tableReady = null;
      throw error;
    });
  return tableReady;
}

function cutoff() {
  return new Date(Date.now() - STALE_MS);
}

function summarise(
  batch: typeof printBatches.$inferSelect,
  counts: { printed: number; printing: number },
): PrintSummary {
  const total = batch.cardCount;
  const done = batch.printedAt ? total : Math.min(total, counts.printed);
  const printing = batch.printedAt ? 0 : Math.min(total - done, counts.printing);
  const status: PrintStatus = batch.printedAt
    ? "completed"
    : printing > 0
      ? "printing"
      : total > 0 && done === total
        ? "ready"
        : done > 0
          ? "in-progress"
          : "not-started";
  return {
    batchId: batch.id,
    batchCode: batch.batchCode,
    total,
    printed: done,
    printing,
    queued: Math.max(0, total - done - printing),
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    status,
    createdAt: batch.createdAt.toISOString(),
  };
}

async function summariesFor(batches: (typeof printBatches.$inferSelect)[]): Promise<PrintSummary[]> {
  if (batches.length === 0) return [];
  const rows = await db
    .select({ batchId: printItemProgress.batchId, state: printItemProgress.state, n: sql<number>`count(*)` })
    .from(printItemProgress)
    .where(
      and(
        inArray(printItemProgress.batchId, batches.map((batch) => batch.id)),
        sql`(${printItemProgress.state} = 'printed' OR (${printItemProgress.state} = 'printing' AND ${printItemProgress.updatedAt} > ${cutoff()}))`,
      ),
    )
    .groupBy(printItemProgress.batchId, printItemProgress.state);
  return batches.map((batch) => {
    const count = (state: string) =>
      Number(rows.find((row) => row.batchId === batch.id && row.state === state)?.n ?? 0);
    return summarise(batch, { printed: count("printed"), printing: count("printing") });
  });
}

export async function listRecentSummaries(limit = 10): Promise<PrintSummary[]> {
  await ensureTable();
  const batches = await db.select().from(printBatches).orderBy(desc(printBatches.id)).limit(limit);
  return summariesFor(batches);
}

export async function listActiveSummaries(): Promise<PrintSummary[]> {
  await ensureTable();
  const active = await db
    .selectDistinct({ batchId: printItemProgress.batchId })
    .from(printItemProgress)
    .where(and(eq(printItemProgress.state, "printing"), gt(printItemProgress.updatedAt, cutoff())));
  if (active.length === 0) return [];
  const batches = await db
    .select()
    .from(printBatches)
    .where(inArray(printBatches.id, active.map((row) => row.batchId)));
  return (await summariesFor(batches)).filter((summary) => summary.status === "printing");
}

export async function getPrintDetail(batchId: number): Promise<PrintDetail | null> {
  await ensureTable();
  const [batch] = await db.select().from(printBatches).where(eq(printBatches.id, batchId)).limit(1);
  if (!batch) return null;

  const [items, progress] = await Promise.all([
    db
      .select({ itemId: printBatchItems.id, app: studentApplications })
      .from(printBatchItems)
      .innerJoin(studentApplications, eq(studentApplications.id, printBatchItems.applicationId))
      .where(eq(printBatchItems.batchId, batchId))
      .orderBy(asc(printBatchItems.id)),
    db.select().from(printItemProgress).where(eq(printItemProgress.batchId, batchId)),
  ]);

  const limit = cutoff();
  const stateOf = new Map<number, PrintItemState>();
  for (const row of progress) {
    if (row.state === "printed") stateOf.set(row.batchItemId, "printed");
    else if (row.state === "printing" && row.updatedAt > limit) stateOf.set(row.batchItemId, "printing");
  }

  let queuePosition = 0;
  const rows: PrintItemRow[] = items.map(({ itemId, app }, index) => {
    const state: PrintItemState = batch.printedAt ? "printed" : (stateOf.get(itemId) ?? "queued");
    return {
      itemId,
      code: app.applicationCode,
      name: fullName(app),
      gradeLevel: app.gradeLevel,
      setNo: Math.floor(index / PRINT_SET_SIZE) + 1,
      state,
      queuePosition: state === "queued" ? ++queuePosition : null,
    };
  });

  const summary = summarise(batch, {
    printed: rows.filter((row) => row.state === "printed").length,
    printing: rows.filter((row) => row.state === "printing").length,
  });
  return { ...summary, setSize: PRINT_SET_SIZE, printedAt: batch.printedAt?.toISOString() ?? null, items: rows };
}

type Failure = { ok: false; status: number; error: string };

export async function startPrintRun(
  batchId: number,
  scope: "all" | number,
): Promise<{ ok: true; started: number } | Failure> {
  await ensureTable();
  return db.transaction(async (tx) => {
    const [batch] = await tx.select().from(printBatches).where(eq(printBatches.id, batchId)).for("update").limit(1);
    if (!batch) return { ok: false as const, status: 404, error: "Print batch not found." };
    if (batch.printedAt) {
      return { ok: false as const, status: 409, error: "This batch has already been confirmed as printed." };
    }

    const [items, progress] = await Promise.all([
      tx.select({ id: printBatchItems.id }).from(printBatchItems).where(eq(printBatchItems.batchId, batchId)).orderBy(asc(printBatchItems.id)),
      tx.select().from(printItemProgress).where(eq(printItemProgress.batchId, batchId)),
    ]);
    const limit = cutoff();
    if (progress.some((row) => row.state === "printing" && row.updatedAt > limit)) {
      return {
        ok: false as const,
        status: 409,
        error: "A print run is still waiting for your confirmation. Confirm or cancel it before starting another.",
      };
    }
    const printed = new Set(progress.filter((row) => row.state === "printed").map((row) => row.batchItemId));
    const targets = items
      .map((item, index) => ({ id: item.id, setNo: Math.floor(index / PRINT_SET_SIZE) + 1 }))
      .filter((item) => !printed.has(item.id) && (scope === "all" || item.setNo === scope));
    if (targets.length === 0) {
      return { ok: false as const, status: 409, error: "There is nothing left to print in that selection." };
    }

    const now = new Date();
    for (let start = 0; start < targets.length; start += 500) {
      await tx
        .insert(printItemProgress)
        .values(targets.slice(start, start + 500).map((item) => ({ batchItemId: item.id, batchId, state: "printing", updatedAt: now })))
        .onDuplicateKeyUpdate({ set: { state: "printing", updatedAt: now } });
    }
    return { ok: true as const, started: targets.length };
  });
}

export async function finishPrintRun(
  batchId: number,
  outcome: "complete" | "cancel",
): Promise<{ ok: true; changed: number } | Failure> {
  await ensureTable();
  return db.transaction(async (tx) => {
    const [batch] = await tx.select().from(printBatches).where(eq(printBatches.id, batchId)).for("update").limit(1);
    if (!batch) return { ok: false as const, status: 404, error: "Print batch not found." };
    if (batch.printedAt) {
      return { ok: false as const, status: 409, error: "This batch has already been confirmed as printed." };
    }
    const where = and(eq(printItemProgress.batchId, batchId), eq(printItemProgress.state, "printing"));
    const waiting = await tx.select({ id: printItemProgress.batchItemId }).from(printItemProgress).where(where);
    if (waiting.length === 0) {
      return { ok: false as const, status: 409, error: "No print run is waiting for confirmation." };
    }
    if (outcome === "complete") {
      await tx.update(printItemProgress).set({ state: "printed", updatedAt: new Date() }).where(where);
    } else {
      await tx.delete(printItemProgress).where(where);
    }
    return { ok: true as const, changed: waiting.length };
  });
}
