import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationLogs,
  studentApplications,
  type NotificationType,
} from "@/db/schema";
import { config } from "@/lib/config";
import { randomToken, sha256Hex } from "@/lib/crypto";
import {
  mailConfigured,
  renderNotification,
} from "@/lib/email-templates";
import { createMailerTransport, mailConfigurationError } from "@/lib/mailer-transport";
import { deliveryErrorFromException } from "@/lib/delivery-error";

type Executor = Pick<typeof db, "insert">;

/**
 * Notification model per spec:
 *  1. the primary business transaction commits first;
 *  2. a notification log row is written (pending);
 *  3. delivery is attempted in a controlled way;
 *  4. failures stay visible to Admins for retry — never silently dropped.
 */
export async function queueNotification(
  opts: {
    applicationId: number;
    type: NotificationType;
    recipientEmail: string;
  },
  executor: Executor = db,
): Promise<number> {
  const rows = await executor
    .insert(notificationLogs)
    .values({
      applicationId: opts.applicationId,
      recipientEmail: opts.recipientEmail,
      notificationType: opts.type,
      sentStatus: "pending",
    })
    .$returningId();
  return rows[0].id;
}

/** Attempt delivery of a previously queued notification and record the outcome. */
export async function deliverNotification(
  notificationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const rows = await db
    .select({ log: notificationLogs, app: studentApplications })
    .from(notificationLogs)
    .leftJoin(
      studentApplications,
      eq(studentApplications.id, notificationLogs.applicationId),
    )
    .where(eq(notificationLogs.id, notificationId))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, error: "Notification not found." };

  const fail = async (message: string) => {
    await db
      .update(notificationLogs)
      .set({
        sentStatus: "failed",
        error: message.slice(0, 500),
        attempts: row.log.attempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(notificationLogs.id, notificationId));
    return { ok: false, error: message };
  };

  if (!row.app) return fail("Linked application no longer exists.");
  if (!row.log.recipientEmail) return fail("No recipient email address on record.");
  if (row.log.acknowledgedAt) {
    const acknowledgedSentAt = row.log.sentAt ?? row.log.acknowledgedAt;
    await db
      .update(notificationLogs)
      .set({
        sentStatus: "sent",
        sentAt: acknowledgedSentAt,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(notificationLogs.id, notificationId));
    return { ok: true };
  }
  if (!mailConfigured()) {
    return fail(mailConfigurationError() || "SMTP configuration is invalid.");
  }

  try {
    const acknowledgementToken = randomToken(32);
    const acknowledgeUrl = `${config.appUrl}/acknowledge?token=${encodeURIComponent(acknowledgementToken)}`;
    const rendered = renderNotification(row.log.notificationType, {
      applicationCode: row.app.applicationCode,
      firstName: row.app.firstName,
    }, { reason: row.app.rejectionReason, acknowledgeUrl });
    const transporter = createMailerTransport();

    await db
      .update(notificationLogs)
      .set({ acknowledgementTokenHash: sha256Hex(acknowledgementToken), updatedAt: new Date() })
      .where(eq(notificationLogs.id, notificationId));

    await transporter.sendMail({
      from: `"${config.mail.fromName.replaceAll('"', "")}" <${config.mail.fromAddress}>`,
      to: row.log.recipientEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await db
      .update(notificationLogs)
      .set({
        sentStatus: "sent",
        sentAt: new Date(),
        error: null,
        attempts: row.log.attempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(notificationLogs.id, notificationId));
    return { ok: true };
  } catch (err) {
    // Never propagate SMTP credentials or internal payloads to callers/logs.
    return fail(deliveryErrorFromException(err));
  }
}

export async function queueAndDeliver(opts: {
  applicationId: number;
  type: NotificationType;
  recipientEmail: string;
}): Promise<number> {
  const id = await queueNotification(opts);
  await deliverNotification(id);
  return id;
}
