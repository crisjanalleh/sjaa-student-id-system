import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { hashIp, sha256Hex } from "@/lib/crypto";
import { rateLimitHit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(result: "success" | "unavailable", token?: string) {
  const destination = result === "success" && token
    ? `/acknowledge?token=${encodeURIComponent(token)}`
    : `/acknowledge?result=${result}`;
  return NextResponse.redirect(
    new URL(destination, config.appUrl),
    { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}

export async function POST(request: Request) {
  const limit = await rateLimitHit(
    `ack:${hashIp(clientIp(request))}`,
    30,
    3600,
  );
  if (!limit.allowed) return redirect("unavailable");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirect("unavailable");
  }

  const token = formData.get("token");
  if (
    formData.get("confirm") !== "received" ||
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{40,60}$/.test(token)
  ) {
    return redirect("unavailable");
  }

  const tokenHash = sha256Hex(token);
  const outcome = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(notificationLogs)
      .where(and(
        eq(notificationLogs.acknowledgementTokenHash, tokenHash),
        eq(notificationLogs.sentStatus, "sent"),
      ))
      .for("update")
      .limit(1);
    const log = rows[0];
    if (!log) return false;
    if (log.acknowledgedAt) return true;

    await tx
      .update(notificationLogs)
      .set({ acknowledgedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(notificationLogs.id, log.id),
        eq(notificationLogs.acknowledgementTokenHash, tokenHash),
      ));
    await audit({
      action: "notification.acknowledged",
      entityType: "notification",
      entityId: log.id,
      metadata: { notificationType: log.notificationType },
      ip: clientIp(request),
    }, tx);
    return true;
  });

  return redirect(outcome ? "success" : "unavailable", outcome ? token : undefined);
}
