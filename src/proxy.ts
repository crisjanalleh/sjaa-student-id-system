import { NextResponse, type NextRequest } from "next/server";

/**
 * Requests that arrive through the public tunnel (Cloudflare adds these
 * headers) may only reach the student-facing pages. The admin area, setup
 * and every admin API stay reachable from this computer only.
 */
const PUBLIC_EXACT = new Set([
  "/",
  "/apply",
  "/acknowledge",
  "/favicon.ico",
  "/api/apply",
  "/api/apply/keepalive",
  "/api/notifications/acknowledge",
]);
const PUBLIC_PREFIXES = ["/_next/", "/__nextjs"];

export function proxy(req: NextRequest) {
  const tunneled = req.headers.has("cf-ray") || req.headers.has("cf-connecting-ip");
  if (!tunneled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }
  return new NextResponse("Not found", {
    status: 404,
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
  });
}
