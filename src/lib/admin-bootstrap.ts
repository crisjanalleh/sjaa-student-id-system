import { sql } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, rateLimits } from "@/db/schema";
import { audit } from "@/lib/audit";

const BOOTSTRAP_LOCK_KEY = "admin-bootstrap:singleton";

export async function createInitialAdmin(input: {
  username: string;
  fullName: string;
  email: string;
  passwordHash: string;
  method: "web" | "cli" | "cli-scripted";
  ip?: string;
}): Promise<number | null> {
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(rateLimits)
      .values({ key: BOOTSTRAP_LOCK_KEY, count: 0, windowStart: now })
      .onDuplicateKeyUpdate({ set: { windowStart: now } });

    const lock = await tx
      .select({ key: rateLimits.key })
      .from(rateLimits)
      .where(sql`${rateLimits.key} = ${BOOTSTRAP_LOCK_KEY}`)
      .for("update")
      .limit(1);
    if (!lock[0]) throw new Error("Could not acquire the administrator bootstrap lock.");

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers);
    if (Number(count) > 0) return null;

    const rows = await tx
      .insert(adminUsers)
      .values({
        username: input.username,
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
      })
      .$returningId();
    const adminId = rows[0].id;

    await audit({
      adminId,
      action: "admin.setup_completed",
      entityType: "admin",
      entityId: adminId,
      metadata: { method: input.method },
      ip: input.ip,
    }, tx);
    return adminId;
  });
}
