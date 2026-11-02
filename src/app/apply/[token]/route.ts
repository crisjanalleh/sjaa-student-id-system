import type { NextRequest } from "next/server";
import { enterWithToken } from "@/lib/access-entry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return enterWithToken(req, token);
}
