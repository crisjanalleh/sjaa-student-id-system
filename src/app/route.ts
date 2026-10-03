import { NextResponse, type NextRequest } from "next/server";
import { FORM_COOKIE, cookieBase, createFormSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { hashIp } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { markTokenUsed, validateAccessToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("access_token") || "";

  if (!raw) {
    return NextResponse.redirect(new URL("/apply", config.appUrl), 302);
  }

  const tokenRow = await validateAccessToken(raw);
  if (!tokenRow) {
    return NextResponse.redirect(new URL("/apply?error=invalid", config.appUrl), 302);
  }

  const ip = clientIp(req);
  const session = await createFormSession(tokenRow.id, tokenRow.expiresAt, hashIp(ip));
  await markTokenUsed(tokenRow.id);

  const res = NextResponse.redirect(new URL("/apply", config.appUrl), 302);
  res.cookies.set(FORM_COOKIE, session.raw, {
    ...cookieBase(),
    maxAge: session.maxAgeSeconds,
  });
  return res;
}
