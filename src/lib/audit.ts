import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { hashIp } from "@/lib/crypto";

export const AUDIT_ACTIONS = [
  "admin.setup_completed",
  "admin.profile_updated",
  "auth.login_success",
  "auth.login_failed",
  "auth.logout",
  "auth.session_expired",
  "token.created",
  "token.revoked",
  "token.regenerated",
  "token.revealed",
  "application.submitted",
  "application.edited",
  "application.approved",
  "application.rejected",
  "application.photo_replaced",
  "application.deleted",
  "application.claimed",
  "template.updated",
  "batch.created",
  "notification.queued",
  "notification.retried",
  "notification.acknowledged",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type Executor = Pick<typeof db, "insert">;

export async function audit(
  opts: {
    adminId?: number | null;
    action: AuditAction;
    entityType?: string;
    entityId?: string | number | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  },
  executor: Executor = db,
): Promise<void> {
  await executor.insert(auditLogs).values({
    adminUserId: opts.adminId ?? null,
    action: opts.action,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId == null ? null : String(opts.entityId),
    metadataJson: opts.metadata ?? null,
    ipHash: opts.ip ? hashIp(opts.ip) : null,
  });
}
