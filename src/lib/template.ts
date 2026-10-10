import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  idTemplateConfig,
  type AdminTemplateConfig,
} from "@/db/schema";
import { normalizeCardDesign } from "@/lib/card-design";

export type TemplateRow = typeof idTemplateConfig.$inferSelect;

type Executor = Pick<typeof db, "select" | "insert">;

export function defaultSchoolYear(now = new Date()): string {
  const y = now.getFullYear();
  return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export async function getTemplateConfig(executor: Executor = db): Promise<TemplateRow> {
  const rows = await executor
    .select()
    .from(idTemplateConfig)
    .orderBy(asc(idTemplateConfig.id))
    .limit(1);
  if (rows[0]) return rows[0];

  const inserted = await executor
    .insert(idTemplateConfig)
    .values({
      version: 1,
      schoolYear: defaultSchoolYear(),
      orientation: "portrait" as const,
      showTrackStrand: true,
      showEmergencyContact: true,
      signatoryName: "",
      signatoryTitle: "School Principal",
    });
  const created = await executor
    .select()
    .from(idTemplateConfig)
    .orderBy(asc(idTemplateConfig.id))
    .limit(1);
  return created[0];
}

export async function getTemplateConfigForUpdate(executor: Executor): Promise<TemplateRow> {
  const rows = await executor
    .select()
    .from(idTemplateConfig)
    .orderBy(asc(idTemplateConfig.id))
    .for("update")
    .limit(1);
  if (rows[0]) return rows[0];
  return getTemplateConfig(executor);
}

export function templateSnapshot(row: TemplateRow) {
  return {
    schoolYear: row.schoolYear,
    orientation: "portrait" as const,
    showTrackStrand: row.showTrackStrand,
    showEmergencyContact: row.showEmergencyContact,
    signatoryName: row.signatoryName,
    signatoryTitle: row.signatoryTitle,
    designSettings: normalizeCardDesign(row.designSettings),
  };
}

export function normalizeTemplateSnapshot(snapshot: unknown): AdminTemplateConfig {
  let value: unknown = snapshot;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }

  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const schoolYear =
    typeof record.schoolYear === "string" ? record.schoolYear : defaultSchoolYear();

  return {
    schoolYear,
    orientation: "portrait",
    showTrackStrand: record.showTrackStrand !== false,
    showEmergencyContact: record.showEmergencyContact !== false,
    signatoryName: typeof record.signatoryName === "string" ? record.signatoryName : "",
    signatoryTitle:
      typeof record.signatoryTitle === "string" ? record.signatoryTitle : "School Principal",
    designSettings: normalizeCardDesign(record.designSettings),
  };
}
