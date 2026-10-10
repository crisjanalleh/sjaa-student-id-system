import { and, desc, asc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { ClipboardList, Inbox, Search } from "lucide-react";
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

export const metadata = { title: "Applications" };

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
          className="inline-flex items-center gap-1 no-underline"
          style={{ color: active ? "var(--academic-blue)" : undefined }}
        >
          {label}
          {active && <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span>}
        </ListLink>
      </th>
    );
  };

  return (
    <div>
      <div className="page-head-stack">
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <ClipboardList className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Applications Queue
        </h1>
        <p className="text-muted text-sm">
          Review, approve, or reject Student ID submissions.
        </p>
      </div>

      <ListCard>
        {/* Filters */}
        <FilterForm key={`${q}|${status}`} action="/admin/applications" className="flex flex-wrap items-end gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <div className="min-w-[220px] flex-1">
            <label className="lbl" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              className="inp"
              defaultValue={q}
              placeholder="Application Control Number, Student ID/LRN, or name…"
              maxLength={80}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="status">
              Status
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
          <FilterSubmit>
            <Search className="h-4 w-4" aria-hidden /> Filter
          </FilterSubmit>
          {(q || status) && (
            <ListLink href="/admin/applications" className="btn btn-ghost">
              Clear
            </ListLink>
          )}
        </FilterForm>

        {/* Results */}
        {apps.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10" style={{ color: "var(--muted)" }} aria-hidden />
            <p className="font-semibold">No applications found</p>
            <p className="text-muted mt-1 text-sm">
              {q || status
                ? "Try adjusting your search or filters."
                : "Submissions will appear here once students apply through the QR link."}
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
                  <th>Grade</th>
                  {sortHeader("status", "Status")}
                  {sortHeader("created", "Submitted")}
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs font-bold">{a.applicationCode}</td>
                    <td className="font-mono text-xs">{a.studentIdNumber}</td>
                    <td className="max-w-[220px] truncate">{fullName(a)}</td>
                    <td className="whitespace-nowrap">
                      {a.gradeLevel}
                      {a.trackStrand ? <span className="text-muted"> · {a.trackStrand.split("—")[0].trim()}</span> : null}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="text-muted whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</td>
                    <td className="!text-right">
                      <Link href={`/admin/applications/${a.id}`} className="btn btn-outline btn-sm">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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
