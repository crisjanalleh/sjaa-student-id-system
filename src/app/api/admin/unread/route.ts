import { NextResponse } from "next/server";
import { csrfOk, requireAdminApi } from "@/lib/auth";
import { readJsonObjectBounded } from "@/lib/request";
import { getUnreadCounts, isUnreadSection, markSectionSeen } from "@/lib/unread";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  return json(200, { ok: true, counts: await getUnreadCounts(ctx.admin.id) });
}

export async function POST(req: Request) {
  const { ctx, error } = await requireAdminApi();
  if (error) return error;
  if (!csrfOk(req, ctx.csrfToken)) return json(403, { ok: false, error: "Security validation failed." });
  const body = await readJsonObjectBounded(req, 1024).catch(() => null);
  if (!body || !isUnreadSection(body.section)) return json(400, { ok: false, error: "Unknown section." });
  await markSectionSeen(ctx.admin.id, body.section);
  return json(200, { ok: true, counts: await getUnreadCounts(ctx.admin.id) });
}
