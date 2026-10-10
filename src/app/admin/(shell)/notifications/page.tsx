import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { Bell, BellOff } from "lucide-react";
import Link from "next/link";
import { FilterForm, FilterSubmit, ListCard, ListLink, Pager } from "@/components/list-card";
import SelectField from "@/components/select-field";
import { db } from "@/db";
import {
  notificationLogs,
  studentApplications,
} from "@/db/schema";
import { getAdminContext } from "@/lib/auth";
import { friendlyDeliveryError } from "@/lib/delivery-error";
import { formatDateTime, maskEmail } from "@/lib/format";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import RetryButton from "./retry-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notification Log" };

const PAGE_SIZE = ADMIN_PAGE_SIZE;
const STATUSES = ["pending", "sent", "failed"] as const;
const TYPES = ["rejection_notice", "ready_for_claiming"] as const;
type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : value?.[0] ?? "";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const ctx = await getAdminContext();

  const rawStatus = firstParam(sp.status);
  const rawType = firstParam(sp.type);
  const status = STATUSES.includes(rawStatus as never) ? rawStatus : "";
  const type = TYPES.includes(rawType as never) ? rawType : "";
  const dateOrder = firstParam(sp.dateOrder) === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number.parseInt(firstParam(sp.page) || "1", 10) || 1);

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(notificationLogs.sentStatus, status as never));
  if (type) conditions.push(eq(notificationLogs.notificationType, type as never));

  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(notificationLogs)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const rows = await db
    .select({
      log: notificationLogs,
      app: studentApplications,
      pendingStale: sql<boolean>`${notificationLogs.updatedAt} < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`,
    })
    .from(notificationLogs)
    .leftJoin(
      studentApplications,
      eq(studentApplications.id, notificationLogs.applicationId),
    )
    .where(where)
    .orderBy(dateOrder === "oldest" ? asc(notificationLogs.createdAt) : desc(notificationLogs.createdAt), desc(notificationLogs.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const qs = (over: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { status, type, dateOrder, page: undefined, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div>
      <div className="page-head-stack">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Bell className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Notification Log
        </h1>
        <p className="text-muted text-sm">
          Every email event is recorded. Failures stay visible here until delivered —
          nothing is silently dropped.
        </p>
      </div>

      <ListCard>
        <FilterForm key={`${status}|${type}`} action="/admin/notifications" className="border-b px-5 py-4" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 45%, var(--card))" }}>
          <div className="mb-3">
            <h2 className="text-xs font-bold">Find notifications</h2>
            <p className="text-muted mt-1 text-xs">Narrow the log by delivery status or email purpose.</p>
          </div>
          <input type="hidden" name="dateOrder" value={dateOrder} />
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,220px)_minmax(220px,1fr)_auto]">
            <div>
              <label className="lbl" htmlFor="n_status">Delivery status</label>
              <SelectField id="n_status" name="status" className="inp w-full" defaultValue={status}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s === "pending" ? "Pending or sending" : s === "sent" ? "Sent successfully" : "Failed"}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className="lbl" htmlFor="n_type">Email purpose</label>
              <SelectField id="n_type" name="type" className="inp w-full" defaultValue={type}>
                <option value="">All email types</option>
                <option value="rejection_notice">Application decision notice</option>
                <option value="ready_for_claiming">ID ready for collection</option>
              </SelectField>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
              <FilterSubmit>Apply filters</FilterSubmit>
              {(status || type) && (
                <ListLink href="/admin/notifications" className="btn btn-outline">Clear</ListLink>
              )}
            </div>
          </div>
        </FilterForm>

        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <BellOff className="mx-auto mb-3 h-10 w-10" style={{ color: "var(--muted)" }} aria-hidden />
            <p className="font-semibold">No notifications match</p>
            <p className="text-muted mt-1 text-sm">Email events appear here as applications move through the workflow.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Control No.</th>
                  <th>Type</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Detail</th>
                  <th>
                    <ListLink
                      href={`/admin/notifications${qs({ dateOrder: dateOrder === "newest" ? "oldest" : "newest" })}`}
                      className="inline-flex items-center gap-1 no-underline"
                    >
                      Created {dateOrder === "newest" ? "↓ Newest first" : "↑ Oldest first"}
                    </ListLink>
                  </th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ log, app, pendingStale }) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs font-bold">
                      {app ? (
                        <Link href={`/admin/applications/${app.id}`} className="underline underline-offset-2" style={{ color: "var(--academic-blue)" }}>
                          {app.applicationCode}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs font-semibold">
                      {log.notificationType === "rejection_notice" ? "Rejection notice" : "Ready for claiming"}
                    </td>
                    <td className="text-xs">{maskEmail(log.recipientEmail)}</td>
                    <td>
                      <span className={`badge ${log.sentStatus === "sent" ? "badge-approved" : log.sentStatus === "failed" ? "badge-rejected" : "badge-pending"}`}>
                        {log.sentStatus}
                      </span>
                    </td>
                    <td className="max-w-[260px]">
                      {log.error ? (
                        <span className="text-xs" style={{ color: "var(--danger)" }}>{friendlyDeliveryError(log.error)}</span>
                      ) : (
                        <span className="text-muted text-xs">
                          {log.sentAt ? `Sent ${formatDateTime(log.sentAt)}` : "—"}
                        </span>
                      )}
                      {log.sentStatus === "sent" && (
                        <span className="mt-1 block text-[11px] font-medium" style={{ color: log.acknowledgedAt ? "var(--success)" : "var(--muted)" }}>
                          {log.acknowledgedAt ? `Acknowledged ${formatDateTime(log.acknowledgedAt)}` : "Awaiting student acknowledgement"}
                        </span>
                      )}
                    </td>
                    <td className="text-muted whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</td>
                    <td className="!text-right">
                      {log.sentStatus === "failed" ||
                      (log.sentStatus === "pending" && pendingStale) ? (
                        <RetryButton id={log.id} csrfToken={ctx!.csrfToken} />
                      ) : log.sentStatus === "pending" ? (
                        <span className="text-muted text-xs">Queued or sending — refresh to check status</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold" style={{ color: "var(--success)" }}>
                          <span aria-hidden>✓</span> No action needed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pager
          basePath="/admin/notifications"
          params={{ status, type, dateOrder }}
          page={safePage}
          totalPages={totalPages}
          summary={`${Number(total)} entr${Number(total) === 1 ? "y" : "ies"} · ${PAGE_SIZE} per page`}
        />
      </ListCard>
    </div>
  );
}
