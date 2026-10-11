import { NextResponse, type NextRequest } from "next/server";
import { FORM_COOKIE, cookieBase, createFormSession } from "@/lib/auth";
import { hashIp } from "@/lib/crypto";
import { isTunneledRequest } from "@/lib/public-url";
import { clientIp } from "@/lib/request";
import { markTokenUsed, validateAccessToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// Relative redirects keep students on whichever public address they scanned.
function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("access_token") || "";

  if (!raw) return redirectTo("/apply");

  const tokenRow = await validateAccessToken(raw);
  if (!tokenRow) return redirectTo("/apply?error=invalid");

  const ip = clientIp(req);
  const session = await createFormSession(tokenRow.id, tokenRow.expiresAt, hashIp(ip));
  await markTokenUsed(tokenRow.id);

  const res = redirectTo("/apply");
  res.cookies.set(FORM_COOKIE, session.raw, {
    ...cookieBase(isTunneledRequest(req.headers) || req.headers.get("x-forwarded-proto") === "https" || undefined),
    maxAge: session.maxAgeSeconds,
  });
  return res;
}
