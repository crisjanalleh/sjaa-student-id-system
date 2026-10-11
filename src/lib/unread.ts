import { count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSectionSeen, notificationLogs, studentApplications } from "@/db/schema";

export const UNREAD_SECTIONS = ["applications", "notifications"] as const;
export type UnreadSection = (typeof UNREAD_SECTIONS)[number];
export type UnreadCounts = Record<UnreadSection, number>;

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

export async function getUnreadCounts(adminId: number): Promise<UnreadCounts> {
  await ensureTable();
  const now = new Date();
  // First visit: start from "now" so a new admin isn't shown the whole history as unread.
  await db
    .insert(adminSectionSeen)
    .values(UNREAD_SECTIONS.map((section) => ({ adminUserId: adminId, section, seenAt: now })))
    .onDuplicateKeyUpdate({ set: { adminUserId: sql`admin_user_id` } });
  const rows = await db.select().from(adminSectionSeen).where(eq(adminSectionSeen.adminUserId, adminId));
  const seen = (section: UnreadSection) => rows.find((row) => row.section === section)?.seenAt ?? now;

  const [apps, notes] = await Promise.all([
    db.select({ n: count() }).from(studentApplications).where(gt(studentApplications.createdAt, seen("applications"))),
    db.select({ n: count() }).from(notificationLogs).where(gt(notificationLogs.createdAt, seen("notifications"))),
  ]);
  return { applications: Number(apps[0]?.n ?? 0), notifications: Number(notes[0]?.n ?? 0) };
}

export async function markSectionSeen(adminId: number, section: UnreadSection) {
  await ensureTable();
  const seenAt = new Date();
  await db
    .insert(adminSectionSeen)
    .values({ adminUserId: adminId, section, seenAt })
    .onDuplicateKeyUpdate({ set: { seenAt } });
}

