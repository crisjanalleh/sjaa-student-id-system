import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { audit } from "@/lib/audit";
import { isAcknowledgementExpired } from "@/lib/acknowledgement-expiry";
import { hashIp, sha256Hex } from "@/lib/crypto";
import { rateLimitHit } from "@/lib/rate-limit";
import {
  clientIp,
  readFormDataBounded,
} from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(result: "success" | "unavailable" | "expired" | "error", token?: string) {
  const destination = result === "success" && token
    ? `/acknowledge?token=${encodeURIComponent(token)}`
    : result === "expired" && token
      ? `/acknowledge?token=${encodeURIComponent(token)}&result=expired`
      : `/acknowledge?result=${result}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: destination, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
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
    formData = await readFormDataBounded(request, 4 * 1024);
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
  let outcome: "ok" | "missing" | "expired";
  try {
    outcome = await db.transaction(async (tx) => {
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
      if (!log) return "missing" as const;
      if (log.acknowledgedAt) return "ok" as const;
      if (isAcknowledgementExpired(log.sentAt)) return "expired" as const;

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
      return "ok" as const;
    });
  } catch (error) {
    console.error("Acknowledgement failed:", error);
    return redirect("error");
  }

  if (outcome === "ok") return redirect("success", token);
  if (outcome === "expired") return redirect("expired", token);
  return redirect("unavailable");
}
