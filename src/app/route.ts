import { type NextRequest } from "next/server";
import { enterWithToken, redirectTo } from "@/lib/access-entry";
import { isTunneledRequest } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("access_token") || "";

  // No token: locally this is the admin entry point; through the public
  // tunnel it stays the student form so shared links keep working.
  if (!raw) return redirectTo(isTunneledRequest(req.headers) ? "/apply" : "/admin");
  return enterWithToken(req, raw);
}
