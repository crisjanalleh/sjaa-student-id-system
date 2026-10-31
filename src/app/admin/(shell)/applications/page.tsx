import { and, desc, asc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { ChevronRight, ClipboardList, Filter, Inbox, Search, X } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { studentApplications } from "@/db/schema";
import StatusBadge from "@/components/status-badge";
import { FilterForm, FilterSubmit, ListCard, ListLink, Pager } from "@/components/list-card";
import SelectField from "@/components/select-field";
import { APPLICATION_STATUSES, STATUS_LABELS } from "@/lib/fields";
import { formatDateTime, fullName } from "@/lib/format";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";

export const dynamic = "force-dynamic";

export const metadata = { title: "Applications Queue — San Jose Adventist Academy" };

const PAGE_SIZE = ADMIN_PAGE_SIZE;

// Strict server-side sort allowlist — request parameters are never
// interpolated into SQL.
const SORTS = {
  created: studentApplications.createdAt,
  code: studentApplications.applicationCode,
  student: studentApplications.studentIdNumber,
  name: studentApplications.lastName,
  status: studentApplications.status,
} as const;
type SortKey = keyof typeof SORTS;
type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : value?.[0] ?? "";
}

function buildQuery(params: Record<string, string | undefined>, override: Record<string, string | undefined>) {
  const merged = { ...params, ...override };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = firstParam(sp.q).slice(0, 80).trim();
  const rawStatus = firstParam(sp.status);
  const rawSort = firstParam(sp.sort);
  const status = APPLICATION_STATUSES.includes(rawStatus as never) ? rawStatus : "";
  const sort: SortKey = Object.prototype.hasOwnProperty.call(SORTS, rawSort)
    ? (rawSort as SortKey)
    : "created";
  const dir = firstParam(sp.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(firstParam(sp.page) || "1", 10) || 1);

  const conditions: SQL[] = [isNull(studentApplications.deletedAt)];
  if (status) conditions.push(eq(studentApplications.status, status as never));
  if (q) {
    const pattern = `%${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        like(sql`LOWER(${studentApplications.applicationCode})`, pattern),
        like(sql`LOWER(${studentApplications.studentIdNumber})`, pattern),
        like(sql`LOWER(${studentApplications.firstName})`, pattern),
        like(sql`LOWER(${studentApplications.lastName})`, pattern),
      )!,
    );
  }

  const orderCol = SORTS[sort];
  const orderBy = [dir === "asc" ? asc(orderCol) : desc(orderCol), desc(studentApplications.id)];

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(studentApplications)
    .where(and(...conditions));
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const apps = await db
    .select()
    .from(studentApplications)
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const baseParams: Record<string, string | undefined> = { q, status, sort, dir };

  const sortHeader = (key: SortKey, label: string) => {
    const active = sort === key;
    const nextDir = active && dir === "desc" ? "asc" : "desc";
    return (
      <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
        <ListLink
          href={`/admin/applications${buildQuery({ ...baseParams, page: undefined }, { sort: key, dir: nextDir })}`}
          className="inline-flex items-center gap-1.5 no-underline font-bold transition-colors"
          style={{ color: active ? "var(--academic-blue)" : undefined }}
        >
          {label}
          {active && <span className="text-[10px]" aria-hidden>{dir === "asc" ? "▲" : "▼"}</span>}
        </ListLink>
      </th>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Breadcrumb & Page Head - matching admin profile design */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="text-[var(--ink)] font-semibold">Applications Queue</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
                <ClipboardList className="h-5 w-5" aria-hidden />
              </span>
              Applications Queue
            </h1>
            <p className="text-muted text-sm mt-1">
              Review, verify, and approve Student ID applications submitted by students.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[var(--indicator-active)]" />
            {Number(total)} Application{Number(total) === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Main List & Table Card */}
      <ListCard className="card overflow-hidden border border-[var(--line)] bg-[var(--elevated)] shadow-sm">
        {/* Filters Header Bar */}
        <FilterForm
          key={`${q}|${status}`}
          action="/admin/applications"
          className="flex flex-wrap items-end gap-3.5 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-4"
        >
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />

          <div className="min-w-[240px] flex-1 space-y-1">
            <label className="lbl" htmlFor="q">
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Search Submissions</span>
            </label>
            <input
              id="q"
              name="q"
              className="inp"
              defaultValue={q}
              placeholder="Application Control No., Student ID/LRN, or Student Name…"
              maxLength={80}
            />
          </div>

          <div className="w-full sm:w-56 space-y-1">
            <label className="lbl" htmlFor="status">
              <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Status Filter</span>
            </label>
            <SelectField id="status" name="status" className="inp" defaultValue={status}>
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <FilterSubmit>
              <Search className="h-4 w-4" aria-hidden /> Filter
            </FilterSubmit>
            {(q || status) && (
              <ListLink href="/admin/applications" className="btn btn-ghost btn-sm gap-1 text-xs">
                <X className="h-3.5 w-3.5" aria-hidden /> Clear
              </ListLink>
            )}
          </div>
        </FilterForm>

        {/* Results Table */}
        {apps.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--line)] text-muted">
              <Inbox className="h-7 w-7" aria-hidden />
            </div>
            <p className="font-bold text-base text-[var(--ink)]">No applications found</p>
            <p className="text-muted mt-1 text-xs max-w-sm mx-auto">
              {q || status
                ? "No applications matched your filter criteria. Try adjusting your search query or reset the filters."
                : "Student ID applications will appear here as soon as students submit their application form."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  {sortHeader("code", "Control No.")}
                  {sortHeader("student", "Student ID / LRN")}
                  {sortHeader("name", "Student Name")}
                  <th>Grade & Track</th>
                  {sortHeader("status", "Status")}
                  {sortHeader("created", "Submitted")}
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--card)]/50 transition-colors">
                    <td className="font-mono text-xs font-bold text-[var(--academic-blue)]">{a.applicationCode}</td>
                    <td className="font-mono text-xs text-muted">{a.studentIdNumber}</td>
                    <td className="max-w-[220px] truncate font-semibold text-sm">{fullName(a)}</td>
                    <td className="whitespace-nowrap text-xs">
                      <span className="font-medium text-[var(--ink)]">{a.gradeLevel}</span>
                      {a.trackStrand ? (
                        <span className="text-muted ml-1 font-normal">· {a.trackStrand.split("—")[0].trim()}</span>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="text-muted whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</td>
                    <td className="!text-right">
                      <Link href={`/admin/applications/${a.id}`} className="btn btn-outline btn-sm font-semibold">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <Pager
          basePath="/admin/applications"
          params={baseParams}
          page={safePage}
          totalPages={totalPages}
          summary={`${Number(total)} record${Number(total) === 1 ? "" : "s"} · ${PAGE_SIZE} per page`}
        />
      </ListCard>
    </div>
  );
}
