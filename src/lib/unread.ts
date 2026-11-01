import { and, count, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminSectionSeen,
  applicationAccessTokens,
  auditLogs,
  notificationLogs,
  studentApplications,
} from "@/db/schema";

export const UNREAD_SECTIONS = ["applications", "print", "qr", "notifications", "audit"] as const;
export type UnreadSection = (typeof UNREAD_SECTIONS)[number];
export type UnreadCounts = Record<UnreadSection, number>;
export const EMPTY_UNREAD: UnreadCounts = { applications: 0, print: 0, qr: 0, notifications: 0, audit: 0 };

let tableReady: Promise<unknown> | null = null;
// The table is created on first use so existing databases don't need a schema push.
function ensureTable() {
  tableReady ??= db
    .execute(sql`CREATE TABLE IF NOT EXISTS admin_section_seen (
      admin_user_id INT NOT NULL,
      section VARCHAR(32) NOT NULL,
      seen_at DATETIME(3) NOT NULL,
      PRIMARY KEY (admin_user_id, section),
      CONSTRAINT admin_section_seen_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    )`)
    .then(() =>
      db.execute(sql`CREATE INDEX IF NOT EXISTS student_applications_status_created_idx ON student_applications (status, created_at)`),
    )
    .catch((error) => {
      tableReady = null;
      throw error;
    });
  return tableReady;
}

export function isUnreadSection(value: unknown): value is UnreadSection {
  return typeof value === "string" && (UNREAD_SECTIONS as readonly string[]).includes(value);
}

// Many open tabs (and bulk intake bursts) poll at once; share one computation per admin for a moment.
const CACHE_MS = 1_500;
const cache = new Map<number, { at: number; value: Promise<UnreadCounts> }>();

async function compute(adminId: number): Promise<UnreadCounts> {
  await ensureTable();
  const now = new Date();
  let rows = await db.select().from(adminSectionSeen).where(eq(adminSectionSeen.adminUserId, adminId));
  const missing = UNREAD_SECTIONS.filter((section) => !rows.some((row) => row.section === section));
  if (missing.length) {
    // First visit: start from "now" so a new admin isn't shown the whole history as unread.
    await db
      .insert(adminSectionSeen)
      .values(missing.map((section) => ({ adminUserId: adminId, section, seenAt: now })))
      .onDuplicateKeyUpdate({ set: { adminUserId: sql`admin_user_id` } });
    rows = await db.select().from(adminSectionSeen).where(eq(adminSectionSeen.adminUserId, adminId));
  }
  const seen = (section: UnreadSection) => rows.find((row) => row.section === section)?.seenAt ?? now;
  const n = (result: { n: number }[]) => Number(result[0]?.n ?? 0);

  const [applications, print, qr, notifications, audit] = await Promise.all([
    db.select({ n: count() }).from(studentApplications).where(
      and(isNull(studentApplications.deletedAt), gt(studentApplications.createdAt, seen("applications"))),
    ),
    // Only applications newly approved and still waiting for a batch are "ready to print".
    db.select({ n: count() }).from(studentApplications).where(
      and(
        isNull(studentApplications.deletedAt),
        eq(studentApplications.status, "approved"),
        gt(studentApplications.reviewedAt, seen("print")),
      ),
    ),
    db.select({ n: count() }).from(applicationAccessTokens).where(gt(applicationAccessTokens.createdAt, seen("qr"))),
    db.select({ n: count() }).from(notificationLogs).where(gt(notificationLogs.createdAt, seen("notifications"))),
    // Your own actions are never "new" to you.
    db.select({ n: count() }).from(auditLogs).where(
      and(
        gt(auditLogs.createdAt, seen("audit")),
        or(isNull(auditLogs.adminUserId), ne(auditLogs.adminUserId, adminId)),
      ),
    ),
  ]);
  return {
    applications: n(applications),
    print: n(print),
    qr: n(qr),
    notifications: n(notifications),
    audit: n(audit),
  };
}

export function getUnreadCounts(adminId: number): Promise<UnreadCounts> {
  const hit = cache.get(adminId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = compute(adminId);
  cache.set(adminId, { at: Date.now(), value });
  value.catch(() => cache.delete(adminId));
  if (cache.size > 200) {
    for (const [key, entry] of cache) if (Date.now() - entry.at > CACHE_MS) cache.delete(key);
  }
  return value;
}

export async function markSectionSeen(adminId: number, section: UnreadSection) {
  await ensureTable();
  const seenAt = new Date();
  await db
    .insert(adminSectionSeen)
    .values({ adminUserId: adminId, section, seenAt })
    .onDuplicateKeyUpdate({ set: { seenAt } });
  cache.delete(adminId);
}
