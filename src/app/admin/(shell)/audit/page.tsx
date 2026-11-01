import { and, asc, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import CountIndicator from "@/components/live-sync";
import { ArrowDownWideNarrow, CalendarDays, ChevronRight, Filter, ScrollText, Search, Tag, X } from "lucide-react";
import Link from "next/link";
import { FilterForm, FilterSubmit, ListCard, ListLink, Pager } from "@/components/list-card";
import SelectField from "@/components/select-field";
import { db } from "@/db";
import { adminUsers, auditLogs } from "@/db/schema";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { auditActionLabel, auditActionTone, auditDetails } from "@/lib/audit-presentation";
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

  const hasFilters = Boolean(action || entity || from || to);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Breadcrumb & Page Head */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="text-[var(--ink)] font-semibold">Audit Logs</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
                <ScrollText className="h-5 w-5" aria-hidden />
              </span>
              Audit Logs
            </h1>
            <p className="text-muted text-sm mt-1">
              A read-only history of important system and administrator activity.
            </p>
          </div>

          <CountIndicator section="audit" total={Number(total)} singular="Event" />
        </div>
      </div>

      {/* Activity Log Card */}
      <ListCard className="card overflow-hidden border border-[var(--line)] bg-[var(--elevated)] shadow-sm">
        {/* Filters Header Bar */}
        <FilterForm
          key={`${action}|${entity}|${from}|${to}`}
          action="/admin/audit"
          className="border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-4"
        >
          <input type="hidden" name="dateOrder" value={dateOrder} />
          <div className="grid items-end gap-3.5 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_auto]">
            <div className="space-y-1">
              <label className="lbl" htmlFor="a_action">
                <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Activity</span>
              </label>
              <SelectField id="a_action" name="action" className="inp w-full" defaultValue={action}>
                <option value="">All activities</option>
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>{auditActionLabel(a)}</option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-1">
              <label className="lbl" htmlFor="a_entity">
                <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Record Type</span>
              </label>
              <SelectField id="a_entity" name="entity" className="inp w-full" defaultValue={entity}>
                <option value="">All record types</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type}>{ENTITY_LABELS[type]}</option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-1">
              <label className="lbl" htmlFor="a_from">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Start Date</span>
              </label>
              <input id="a_from" name="from" type="date" className="inp w-full" defaultValue={from} />
            </div>
            <div className="space-y-1">
              <label className="lbl" htmlFor="a_to">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>End Date</span>
              </label>
              <input id="a_to" name="to" type="date" className="inp w-full" defaultValue={to} />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 sm:col-span-2 xl:col-span-1">
              <FilterSubmit>
                <Search className="h-4 w-4" aria-hidden /> Filter
              </FilterSubmit>
              {hasFilters && (
                <ListLink href="/admin/audit" className="btn btn-ghost btn-sm gap-1 text-xs">
                  <X className="h-3.5 w-3.5" aria-hidden /> Clear
                </ListLink>
              )}
            </div>
          </div>
        </FilterForm>

        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--line)] text-muted">
              <ScrollText className="h-7 w-7" aria-hidden />
            </div>
            <p className="font-bold text-base text-[var(--ink)]">No audit entries found</p>
            <p className="text-muted mt-1 text-xs max-w-sm mx-auto">
              {hasFilters
                ? "No activity matched your filter criteria. Try adjusting the filters or clearing them."
                : "System and administrator activity will be recorded here as it happens."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th aria-sort={dateOrder === "newest" ? "descending" : "ascending"}>
                    <ListLink
                      href={`/admin/audit${qs({ dateOrder: dateOrder === "newest" ? "oldest" : "newest" })}`}
                      className="inline-flex items-center gap-1.5 no-underline font-bold transition-colors"
                    >
                      Timestamp
                      <ArrowDownWideNarrow className={`h-3.5 w-3.5 ${dateOrder === "newest" ? "" : "rotate-180"}`} aria-hidden />
                    </ListLink>
                  </th>
                  <th>Actor</th>
                  <th>Activity</th>
                  <th>Record Affected</th>
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
                      <span className={`badge badge-${auditActionTone(log.action)} !normal-case`}>
                        {auditActionLabel(log.action)}
                      </span>
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

        <Pager
          basePath="/admin/audit"
          params={{ action, entity, from, to, dateOrder }}
          page={safePage}
          totalPages={totalPages}
          summary={`${PAGE_SIZE} per page`}
        />
      </ListCard>
    </div>
  );
}
