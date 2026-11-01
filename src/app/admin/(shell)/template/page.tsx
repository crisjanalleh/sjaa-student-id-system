import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { normalizeCardDesign } from "@/lib/card-design";
import { getTemplateConfig } from "@/lib/template";
import { ChevronRight, IdCard } from "lucide-react";
import Link from "next/link";
import QuickTip from "@/components/quick-tip";
import { StatusPill } from "@/components/live-sync";
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
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Breadcrumb & Page Head */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="text-[var(--ink)] font-semibold">ID Template</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
                <IdCard className="h-5 w-5" aria-hidden />
              </span>
              ID Template Management
            </h1>
            <p className="text-muted text-sm mt-1">
              Configure which fields appear on the printed CR80 card. Every saved change
              increments the template version recorded on future print batches.
            </p>
          </div>

          <StatusPill tone="active">Active version v{row.version}</StatusPill>
        </div>

        <p className="text-muted text-xs">
          Last updated {formatDateTime(row.updatedAt)}
          {updatedByName ? ` by ${updatedByName}` : ""}
        </p>

        <QuickTip
          className="mt-1"
          items={[
            "Visibility toggles control which fields appear on generated ID cards.",
            "Check both the Junior High and Senior High previews before saving.",
          ]}
        />
      </div>

      <TemplateEditor
        initialVersion={row.version}
        csrfToken={ctx!.csrfToken}
        initial={{
          schoolYear: row.schoolYear,
          orientation: "portrait",
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
