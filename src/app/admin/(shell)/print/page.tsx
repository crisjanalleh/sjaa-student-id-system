import { and, asc, desc, eq, isNull, notExists, sql } from "drizzle-orm";
import { CalendarClock, ChevronRight, Printer } from "lucide-react";
import QuickTip from "@/components/quick-tip";
import Link from "next/link";
import { db } from "@/db";
import { adminUsers, printBatchItems, printBatches, studentApplications } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import { formatDateTime, fullName } from "@/lib/format";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import PrintSelect from "./print-select";
import BatchProgressCell from "./batch-progress-cell";
import { listRecentSummaries } from "@/lib/print-progress";
import { ListCard, ListLink, Pager } from "@/components/list-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Batch Print" };

const PAGE_SIZE = ADMIN_PAGE_SIZE;

export default async function PrintSelectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAdminContext();
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawDateOrder = Array.isArray(params.dateOrder) ? params.dateOrder[0] : params.dateOrder;
  const dateOrder = rawDateOrder === "oldest" ? "oldest" : "newest";
  const requestedPage = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);
  const notAlreadyBatched = notExists(
    db
      .select({ id: printBatchItems.id })
      .from(printBatchItems)
      .where(eq(printBatchItems.applicationId, studentApplications.id)),
  );

  const [[{ totalApproved }], recentBatches] = await Promise.all([
    db
      .select({ totalApproved: sql<number>`count(*)` })
      .from(studentApplications)
      .where(and(eq(studentApplications.status, "approved"), isNull(studentApplications.deletedAt), notAlreadyBatched)),
    db
      .select({ batch: printBatches, admin: adminUsers })
      .from(printBatches)
      .leftJoin(adminUsers, eq(adminUsers.id, printBatches.createdByAdminId))
      .orderBy(
        dateOrder === "oldest"
          ? asc(sql`COALESCE(${printBatches.printedAt}, ${printBatches.createdAt})`)
          : desc(sql`COALESCE(${printBatches.printedAt}, ${printBatches.createdAt})`),
        desc(printBatches.id),
      )
      .limit(PAGE_SIZE),
  ]);
  const totalPages = Math.max(1, Math.ceil(Number(totalApproved) / PAGE_SIZE));
  const summaryById = new Map((await listRecentSummaries(PAGE_SIZE)).map((entry) => [entry.batchId, entry]));
  const page = Math.min(requestedPage, totalPages);
  const approved = await db
    .select()
    .from(studentApplications)
    .where(and(eq(studentApplications.status, "approved"), isNull(studentApplications.deletedAt), notAlreadyBatched))
    .orderBy(dateOrder === "oldest" ? asc(studentApplications.approvedAt) : desc(studentApplications.approvedAt), desc(studentApplications.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const serialized = approved.map((a) => ({
    id: a.id,
    code: a.applicationCode,
    studentIdNumber: a.studentIdNumber,
    name: fullName(a),
    gradeLevel: a.gradeLevel,
    approvedAt: a.approvedAt ? a.approvedAt.toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Breadcrumb & Page Head */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="text-[var(--ink)] font-semibold">Batch Print</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
                <Printer className="h-5 w-5" aria-hidden />
              </span>
              Batch Printing
            </h1>
            <p className="text-muted text-sm mt-1">
              Select approved applications, confirm the batch, and print CR80 ID cards. A batch records the template version used — for example at the end of each month — and each record can be printed exactly once.
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[var(--indicator-active)]" />
            {Number(totalApproved)} Ready to Print
          </div>
        </div>

        <QuickTip
          className="mt-1"
          items={[
            "Tick only approved applications you are ready to print now.",
            "Each record can be printed once, and the batch stores the template version used.",
          ]}
        />
      </div>

      <ListCard className="card overflow-hidden border border-[var(--line)] bg-[var(--elevated)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            </span>
            Recent Batches
          </h2>
          <ListLink
            href={`/admin/print?dateOrder=${dateOrder === "newest" ? "oldest" : "newest"}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]"
          >
            {dateOrder === "newest" ? "Newest first" : "Oldest first"}
            <span className="text-[10px]" aria-hidden>{dateOrder === "newest" ? "▼" : "▲"}</span>
          </ListLink>
        </div>
        {recentBatches.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--line)] text-muted">
              <CalendarClock className="h-7 w-7" aria-hidden />
            </div>
            <p className="font-bold text-base text-[var(--ink)]">No print batches yet</p>
            <p className="text-muted mt-1 text-xs max-w-sm mx-auto">
              Batches you create appear here with their template version and print progress.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Cards</th>
                  <th>Template</th>
                  <th>Created By</th>
                  <th>Created / Printed</th>
                  <th>Progress</th>
                  <th className="!text-right">Output</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map(({ batch, admin }) => (
                  <tr key={batch.id}>
                    <td className="font-mono text-xs font-bold">{batch.batchCode}</td>
                    <td>{batch.cardCount}</td>
                    <td className="text-xs">v{batch.templateVersion}</td>
                    <td className="text-xs">{admin?.fullName || "—"}</td>
                    <td className="text-muted text-xs">
                      {batch.printedAt
                        ? `Printed ${formatDateTime(batch.printedAt)}`
                        : `Created ${formatDateTime(batch.createdAt)}`}
                    </td>
                    <td>
                      <BatchProgressCell batchId={batch.id} summary={summaryById.get(batch.id) ?? null} />
                    </td>
                    <td className="!text-right">
                      <Link href={`/admin/print/${batch.id}`} className="btn btn-outline btn-sm" target="_blank">
                        View / Print
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListCard>

      <ListCard className="card overflow-hidden border border-[var(--line)] bg-[var(--elevated)] shadow-sm">
        <PrintSelect key={page} applications={serialized} csrfToken={ctx!.csrfToken} />
        {Number(totalApproved) > 0 && (
          <Pager
            basePath="/admin/print"
            params={{ dateOrder }}
            page={page}
            totalPages={totalPages}
            summary={`${PAGE_SIZE} per page`}
          />
        )}
      </ListCard>
    </div>
  );
}
