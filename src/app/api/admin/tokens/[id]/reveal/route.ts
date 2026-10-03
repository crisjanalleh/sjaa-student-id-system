import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationAccessTokens } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { config } from "@/lib/config";
import { decryptAccessToken, safeEqual, sha256Hex } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid access link." }, { status: 400 });
  }

  const [token] = await db
    .select()
    .from(applicationAccessTokens)
    .where(eq(applicationAccessTokens.id, id))
    .limit(1);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Access link not found." }, { status: 404 });
  }
  if (token.revokedAt || (token.expiresAt && token.expiresAt.getTime() <= Date.now())) {
    return NextResponse.json({ ok: false, error: "This access link is no longer active." }, { status: 410 });
  }
  if (!token.tokenCiphertext) {
    return NextResponse.json({
      ok: false,
      error: "This link was created before secure link recovery was enabled. Regenerate it to create a shareable replacement.",
    }, { status: 409 });
  }

  const raw = decryptAccessToken(token.tokenCiphertext);
  if (!raw || !safeEqual(sha256Hex(raw), token.tokenHash)) {
    return NextResponse.json({
      ok: false,
      error: "The saved link could not be verified. Regenerate it to create a new shareable link.",
    }, { status: 409 });
  }

  return NextResponse.json(
    { ok: true, url: `${config.appUrl}/?access_token=${raw}` },
    { headers: { "Cache-Control": "no-store, private", Pragma: "no-cache" } },
  );
}
