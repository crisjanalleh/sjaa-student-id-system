import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { FORM_COOKIE, cookieBase, createFormSession } from "@/lib/auth";
import { hashIp } from "@/lib/crypto";
import { isTunneledRequest } from "@/lib/public-url";
import { clientIp } from "@/lib/request";
import { markTokenUsed, validateAccessToken } from "@/lib/tokens";

// Relative redirects keep students on whichever public address they scanned.
export function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

/** Validates an access token, starts the student's form session and sends them to the form. */
export async function enterWithToken(req: NextRequest, raw: string) {
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(raw)) return redirectTo("/apply?error=invalid");

  const tokenRow = await validateAccessToken(raw);
  if (!tokenRow) return redirectTo("/apply?error=invalid");

  // Independent writes run together to keep the first load fast.
  const [session] = await Promise.all([
    createFormSession(tokenRow.id, tokenRow.expiresAt, hashIp(clientIp(req))),
    markTokenUsed(tokenRow.id).catch(() => undefined),
  ]);

  const res = redirectTo("/apply");
  res.cookies.set(FORM_COOKIE, session.raw, {
    ...cookieBase(isTunneledRequest(req.headers) || req.headers.get("x-forwarded-proto") === "https" || undefined),
    maxAge: session.maxAgeSeconds,
  });
  return res;
}
