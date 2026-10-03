import { and, asc, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { adminUsers, auditLogs } from "@/db/schema";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { auditActionLabel, auditActionStyle, auditDetails } from "@/lib/audit-presentation";
import { formatDateTime } from "@/lib/format";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";

export const dynamic = "force-dynamic";

export const metadata = { title: "Audit Logs" };

const PAGE_SIZE = ADMIN_PAGE_SIZE;
const ENTITY_LABELS = {
  application: "Student application",
  access_token: "Application link",
  admin: "Administrator account",
  print_batch: "ID print batch",
  template: "ID card template",
  notification: "Email notification",
} as const;
type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : value?.[0] ?? "";
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rawAction = firstParam(sp.action);
  const action = AUDIT_ACTIONS.includes(rawAction as never) ? rawAction : "";
  const entity = firstParam(sp.entity).slice(0, 60).trim();
  const rawFrom = firstParam(sp.from);
  const rawTo = firstParam(sp.to);
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const from = validDate(rawFrom) ? rawFrom : "";
  const to = validDate(rawTo) ? rawTo : "";
  const dateOrder = firstParam(sp.dateOrder) === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number.parseInt(firstParam(sp.page) || "1", 10) || 1);

  const conditions: SQL[] = [];
  if (action) conditions.push(eq(auditLogs.action, action as never));
  if (entity) conditions.push(eq(auditLogs.entityType, entity));
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(`${from}T00:00:00Z`)));
  if (to) conditions.push(lt(auditLogs.createdAt, new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000)));

  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(auditLogs)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const rows = await db
    .select({ log: auditLogs, admin: adminUsers })
    .from(auditLogs)
    .leftJoin(adminUsers, eq(adminUsers.id, auditLogs.adminUserId))
    .where(where)
    .orderBy(dateOrder === "oldest" ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const entityTypes = Object.keys(ENTITY_LABELS) as (keyof typeof ENTITY_LABELS)[];

  const qs = (over: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { action, entity, from, to, dateOrder, page: undefined, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <ScrollText className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Audit Logs
        </h1>
        <p className="text-muted text-sm">
          A read-only history of important system and administrator activity. Use the filters
          to find a specific activity, record type, or date range.
        </p>
      </div>

      <div className="card">
        <form method="GET" action="/admin/audit" className="border-b px-5 py-4" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 45%, var(--card))" }}>
          <div className="mb-3">
            <h2 className="text-xs font-bold">Find an activity</h2>
            <p className="text-muted mt-1 text-xs">Choose what you are looking for, then narrow it by record type or date.</p>
          </div>
          <input type="hidden" name="dateOrder" value={dateOrder} />
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_minmax(145px,0.8fr)_minmax(145px,0.8fr)_auto]">
            <div>
              <label className="lbl" htmlFor="a_action">Activity</label>
              <select id="a_action" name="action" className="inp w-full" defaultValue={action}>
                <option value="">All activities</option>
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>{auditActionLabel(a)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="a_entity">Record type</label>
              <select id="a_entity" name="entity" className="inp w-full" defaultValue={entity}>
                <option value="">All record types</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type}>{ENTITY_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="a_from">Start date</label>
              <input id="a_from" name="from" type="date" className="inp w-full" defaultValue={from} />
            </div>
            <div>
              <label className="lbl" htmlFor="a_to">End date</label>
              <input id="a_to" name="to" type="date" className="inp w-full" defaultValue={to} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1">
              <button type="submit" className="btn btn-primary">Apply filters</button>
              {(action || entity || from || to) && (
                <Link href="/admin/audit" className="btn btn-outline">Clear</Link>
              )}
            </div>
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="text-muted px-4 py-14 text-center text-sm">No audit entries match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>
                    <Link
                      href={`/admin/audit${qs({ dateOrder: dateOrder === "newest" ? "oldest" : "newest" })}`}
                      className="inline-flex items-center gap-1 no-underline"
                    >
                      Timestamp {dateOrder === "newest" ? "↓ Newest first" : "↑ Oldest first"}
                    </Link>
                  </th>
                  <th>Actor</th>
                  <th>Activity</th>
                  <th>Record affected</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ log, admin }) => (
                  <tr key={log.id}>
                    <td className="text-muted whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</td>
                    <td className="whitespace-nowrap text-xs font-semibold">
                      {admin ? admin.fullName : <span className="text-muted">System or public user</span>}
                    </td>
                    <td>
                      {(() => {
                        const style = auditActionStyle(log.action);
                        return (
                          <span
                            className="badge !normal-case"
                            style={{ color: style.color, background: style.background, borderColor: style.border }}
                          >
                            {style.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="text-muted whitespace-nowrap text-xs">
                      {log.entityType
                        ? `${ENTITY_LABELS[log.entityType as keyof typeof ENTITY_LABELS] ?? log.entityType}${log.entityId ? ` #${log.entityId}` : ""}`
                        : "—"}
                    </td>
                    <td className="max-w-[340px] text-muted text-xs leading-relaxed">
                      {auditDetails(log.action, log.metadataJson) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted text-xs">
            {Number(total)} entr{Number(total) === 1 ? "y" : "ies"} · Page {safePage} of {totalPages} · {PAGE_SIZE} per page
          </span>
          <div className="flex gap-2">
            <Link className={`btn btn-outline btn-sm ${safePage <= 1 ? "pointer-events-none opacity-50" : ""}`} href={`/admin/audit${qs({ page: String(safePage - 1) })}`} aria-disabled={safePage <= 1}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </Link>
            <Link className={`btn btn-outline btn-sm ${safePage >= totalPages ? "pointer-events-none opacity-50" : ""}`} href={`/admin/audit${qs({ page: String(safePage + 1) })}`} aria-disabled={safePage >= totalPages}>
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
