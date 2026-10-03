import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { normalizeCardDesign } from "@/lib/card-design";
import { getTemplateConfig } from "@/lib/template";
import { IdCard } from "lucide-react";
import TemplateEditor from "./template-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "ID Template" };

export default async function TemplatePage() {
  const ctx = await getAdminContext();
  const row = await getTemplateConfig();
  let updatedByName: string | null = null;
  if (row.updatedByAdminId) {
    const u = await db
      .select({ fullName: adminUsers.fullName })
      .from(adminUsers)
      .where(eq(adminUsers.id, row.updatedByAdminId))
      .limit(1);
    updatedByName = u[0]?.fullName ?? null;
  }
  void ctx;

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <IdCard className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          ID Template Management
        </h1>
        <p className="text-muted text-sm">
          Configure which fields appear on the printed CR80 card. Every saved change
          increments the template version recorded on future print batches.
        </p>
      </div>
      <div className="text-muted mb-4 text-xs">
        Active version{" "}
        <span className="badge badge-active !text-[10.5px]">v{row.version}</span>{" "}
        · Last updated {formatDateTime(row.updatedAt)}
        {updatedByName ? ` by ${updatedByName}` : ""}
      </div>
      <TemplateEditor
        initialVersion={row.version}
        csrfToken={ctx!.csrfToken}
        initial={{
          schoolYear: row.schoolYear,
          orientation: row.orientation,
          showBloodType: row.showBloodType,
          showTrackStrand: row.showTrackStrand,
          showEmergencyContact: row.showEmergencyContact,
          signatoryName: row.signatoryName,
          signatoryTitle: row.signatoryTitle,
          designSettings: normalizeCardDesign(row.designSettings),
        }}
      />
    </div>
  );
}
