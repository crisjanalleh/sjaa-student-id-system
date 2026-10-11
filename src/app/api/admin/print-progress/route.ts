import { NextResponse } from "next/server";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import {
  finishPrintRun,
  getPrintDetail,
  listActiveSummaries,
  listRecentSummaries,
  startPrintRun,
} from "@/lib/print-progress";
import { readJsonObjectBounded } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// GET ?batchId=N -> one batch in detail; ?recent=1 -> latest batches; no query -> batches printing now.
export async function GET(req: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;
  const params = new URL(req.url).searchParams;

  const rawBatch = params.get("batchId");
  if (rawBatch !== null) {
    const batchId = Number.parseInt(rawBatch, 10);
    if (!Number.isInteger(batchId) || batchId <= 0) return json(400, { ok: false, error: "Invalid print batch." });
    const detail = await getPrintDetail(batchId);
    return detail ? json(200, { ok: true, detail }) : json(404, { ok: false, error: "Print batch not found." });
  }
  if (params.get("recent")) return json(200, { ok: true, batches: await listRecentSummaries(10) });
  return json(200, { ok: true, active: await listActiveSummaries() });
}

export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });

  const body = await readJsonObjectBounded(req, 2048).catch(() => null);
  const batchId = typeof body?.batchId === "number" ? body.batchId : NaN;
  if (!body || !Number.isInteger(batchId) || batchId <= 0) return json(400, { ok: false, error: "Invalid print batch." });

  if (body.action === "start") {
    const scope = body.scope === "all" ? "all" : body.scope;
    if (scope !== "all" && !(typeof scope === "number" && Number.isInteger(scope) && scope > 0)) {
      return json(400, { ok: false, error: "Choose a set to print." });
    }
    const result = await startPrintRun(batchId, scope);
    if (!result.ok) return json(result.status, { ok: false, error: result.error });
  } else if (body.action === "complete" || body.action === "cancel") {
    const result = await finishPrintRun(batchId, body.action);
    if (!result.ok) return json(result.status, { ok: false, error: result.error });
  } else {
    return json(400, { ok: false, error: "Unknown action." });
  }

  const detail = await getPrintDetail(batchId);
  return json(200, { ok: true, detail });
}
