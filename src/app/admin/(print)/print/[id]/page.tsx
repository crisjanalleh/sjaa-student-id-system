import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  adminUsers,
  printBatchItems,
  printBatches,
  studentApplications,
} from "@/db/schema";
import { IdCard, type IdCardData } from "@/components/id-card";
import { formatDateTime } from "@/lib/format";
import { normalizeTemplateSnapshot } from "@/lib/template";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Print Batch Output" };

function cardData(a: typeof studentApplications.$inferSelect): IdCardData {
  const mi = a.middleName ? ` ${a.middleName.charAt(0)}.` : "";
  const sfx = a.suffix ? ` ${a.suffix.toUpperCase()}` : "";
  return {
    controlNo: a.applicationCode,
    studentIdNumber: a.studentIdNumber,
    fullNameLine: `${a.lastName.toUpperCase()}, ${a.firstName.toUpperCase()}${mi}${sfx}`,
    gradeLevel: a.gradeLevel,
    trackStrand: a.trackStrand,
    bloodType: a.bloodType,
    emergencyContactName: a.emergencyContactName,
    emergencyContactPhone: a.emergencyContactPhone,
  };
}

function chunks<T>(items: T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

export default async function PrintBatchOutputPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const batchRows = await db
    .select({ batch: printBatches, creator: adminUsers })
    .from(printBatches)
    .leftJoin(adminUsers, eq(adminUsers.id, printBatches.createdByAdminId))
    .where(eq(printBatches.id, id))
    .limit(1);
  if (!batchRows[0]) notFound();
  const { batch, creator } = batchRows[0];

  // Data isolation: only applications captured into THIS batch are rendered.
  const items = await db
    .select({ app: studentApplications })
    .from(printBatchItems)
    .innerJoin(studentApplications, eq(studentApplications.id, printBatchItems.applicationId))
    .where(eq(printBatchItems.batchId, id))
    .orderBy(asc(printBatchItems.id));

  const template = normalizeTemplateSnapshot(batch.templateSnapshot);
  const cardsPerPage = template.orientation === "portrait" ? 9 : 8;
  const pages = chunks(items, cardsPerPage);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Screen-only toolbar */}
      <div
        className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ink)" }}
      >
        <Link href="/admin/print" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <div className="flex-1">
          <p className="text-sm font-bold">
            Batch <span className="font-mono">{batch.batchCode}</span>
          </p>
          <p className="text-muted text-xs">
            {items.length} card{items.length === 1 ? "" : "s"} · Template v{batch.templateVersion} ·{" "}
            {creator ? creator.fullName : "—"} · {formatDateTime(batch.printedAt || batch.createdAt)}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="no-print mx-auto mb-4 mt-4 flex max-w-4xl items-start gap-2 rounded-md border px-4 py-3 text-xs leading-relaxed" style={{ borderColor: "var(--line-strong)", background: "var(--card)", color: "var(--muted)" }}>
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Cards are laid out at exact CR80 size ({template.orientation === "portrait" ? "53.98 × 85.60" : "85.60 × 53.98"}&nbsp;mm). In the print
          dialog choose A4, 100% scale, and disable browser headers/footers. The front
          sheet and back sheet are separated by an automatic page break for duplex ID
          card printing workflows.
        </span>
      </div>
      {notice === "notification-attention" && (
        <p className="no-print mx-auto mb-4 max-w-4xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          The print batch was created, but one or more email notices could not be confirmed as delivered. Check the Notification Log before retrying them.
        </p>
      )}

      {items.length === 0 ? (
        <p className="no-print px-4 py-10 text-center text-sm">This batch contains no records.</p>
      ) : (
        <div className="print-output-wrapper mx-auto w-fit px-2 pb-10">
          <h2 className="no-print lbl !mb-3 !mt-4">Front sheet</h2>
          <div className="print-sheet" data-orientation={template.orientation}>
            {pages.map((pageItems, pageIndex) => (
              <div
                key={`front-page-${pageIndex}`}
                className="print-page"
                data-orientation={template.orientation}
              >
                {pageItems.map(({ app }) => (
                  <IdCard
                    key={`f-${app.id}`}
                    variant="front"
                    template={template}
                    data={cardData(app)}
                    photoUrl={
                      app.photoStorageKey ? `/api/admin/applications/${app.id}/photo` : null
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          <h2 className="no-print lbl !mb-3 !mt-6">Back sheet</h2>
          <div className="print-sheet print-back-sheet" data-orientation={template.orientation}>
            {pages.map((pageItems, pageIndex) => (
              <div
                key={`back-page-${pageIndex}`}
                className="print-page"
                data-orientation={template.orientation}
              >
                {pageItems.map(({ app }) => (
                  <IdCard key={`b-${app.id}`} variant="back" template={template} data={cardData(app)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
