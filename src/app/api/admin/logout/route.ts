import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import {
  ADMIN_COOKIE,
  cookieBase,
  csrfOk,
  destroyAdminSession,
  getAdminContext,
} from "@/lib/auth";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getAdminContext();
  if (ctx) {
    if (!csrfOk(req, ctx.csrfToken)) {
      return NextResponse.json({ ok: false, error: "Security validation failed." }, { status: 403 });
    }
    await audit({
      adminId: ctx.admin.id,
      action: "auth.logout",
      entityType: "admin",
      entityId: ctx.admin.id,
      ip: clientIp(req),
    });
  }
  await destroyAdminSession();
  const res = NextResponse.json({ ok: true, redirect: "/admin/login" }, { status: 200 });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return res;
}
