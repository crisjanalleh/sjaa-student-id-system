import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema";
import { SCHOOL } from "@/lib/config";

let tableReady: Promise<void> | null = null;

// Created on demand so existing databases do not need a schema push.
export function ensureSchoolSettingsTable(): Promise<void> {
  tableReady ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS school_settings (
        id INT NOT NULL PRIMARY KEY,
        address VARCHAR(300) NOT NULL,
        updated_by_admin_id INT NULL,
        updated_at DATETIME(3) NOT NULL DEFAULT (now())
      )`,
    )
    .then(() => undefined)
    .catch((err) => {
      tableReady = null;
      throw err;
    });
  return tableReady;
}

export async function getSchoolAddress(): Promise<string> {
  try {
    await ensureSchoolSettingsTable();
    const [row] = await db
      .select({ address: schoolSettings.address })
      .from(schoolSettings)
      .where(eq(schoolSettings.id, 1))
      .limit(1);
    return row?.address?.trim() || SCHOOL.address;
  } catch {
    return SCHOOL.address;
  }
}
