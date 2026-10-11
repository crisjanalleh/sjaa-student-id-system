import { NextResponse } from "next/server";
import { csrfOk, getFormContext, touchFormSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Called by the student form while the student is active, to keep the 30-minute idle window open. */
export async function POST(req: Request) {
  const ctx = await getFormContext();
  if (!ctx) return json(401, { ok: false, expired: true });
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });
  const alive = await touchFormSession(ctx);
  if (!alive) return json(401, { ok: false, expired: true });
  return json(200, { ok: true });
}
