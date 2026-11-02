import { inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { checkTokenHealth } from "@/lib/token-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only health check for the tokens on screen. It never touches use counts or student sessions. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ ok: true, results: [] });

  const rows = await db
    .select({
      id: applicationAccessTokens.id,
      tokenHash: applicationAccessTokens.tokenHash,
      tokenCiphertext: applicationAccessTokens.tokenCiphertext,
      expiresAt: applicationAccessTokens.expiresAt,
      revokedAt: applicationAccessTokens.revokedAt,
    })
    .from(applicationAccessTokens)
    .where(inArray(applicationAccessTokens.id, ids));

  const results = await checkTokenHealth(rows, req.nextUrl.searchParams.get("fresh") === "1");
  return NextResponse.json({ ok: true, results }, { headers: { "Cache-Control": "no-store, private" } });
}
