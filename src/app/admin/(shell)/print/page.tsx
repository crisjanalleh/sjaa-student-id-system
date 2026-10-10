import { and, asc, desc, eq, isNull, notExists, sql } from "drizzle-orm";
import { CalendarClock, Printer } from "lucide-react";
import QuickTip from "@/components/quick-tip";
import Link from "next/link";
import { db } from "@/db";
import { adminUsers, printBatchItems, printBatches, studentApplications } from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import { formatDateTime, fullName } from "@/lib/format";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import PrintSelect from "./print-select";
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
    <div>
      <div className="page-head-stack">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Printer className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Batch Printing
        </h1>
        <p className="text-muted text-sm">
          Select approved applications, confirm the batch, and print CR80 ID cards. A
          batch records the template version used — for example at the end of each
          month — and each record can be printed exactly once.
        </p>
        <QuickTip
          className="mt-3"
          items={[
            "Tick only approved applications you are ready to print now.",
            "Each record can be printed once, and the batch stores the template version used.",
          ]}
        />
      </div>

      <ListCard className="">
        <PrintSelect key={page} applications={serialized} csrfToken={ctx!.csrfToken} />
        {Number(totalApproved) > 0 && (
          <Pager
            basePath="/admin/print"
            params={{ dateOrder }}
            page={page}
            totalPages={totalPages}
            summary={`Showing ${Math.min(Number(totalApproved), (page - 1) * PAGE_SIZE + 1)}–${Math.min(Number(totalApproved), page * PAGE_SIZE)} of ${Number(totalApproved)} approved · ${PAGE_SIZE} per page`}
          />
        )}
      </ListCard>

      <ListCard className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Recent Batches
        </h2>
        <ListLink href={`/admin/print?dateOrder=${dateOrder === "newest" ? "oldest" : "newest"}`} className="text-xs font-semibold no-underline" style={{ color: "var(--academic-blue)" }}>
          {dateOrder === "newest" ? "↓ Newest first" : "↑ Oldest first"}
        </ListLink>
        </div>
        {recentBatches.length === 0 ? (
          <p className="text-muted px-4 py-6 text-center text-sm">No print batches yet.</p>
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
    </div>
  );
}
