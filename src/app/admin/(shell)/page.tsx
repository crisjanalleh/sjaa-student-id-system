import { and, asc, desc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import { Activity, ArrowRight, Layers, LayoutDashboard, Link2, QrCode } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { db } from "@/db";
import {
  adminUsers,
  applicationAccessTokens,
  auditLogs,
  studentApplications,
} from "@/db/schema";
import IssuanceAnalytics, { type AnalyticsMonth } from "@/components/issuance-analytics";
import { ListCard, ListLink } from "@/components/list-card";
import StatusBadge from "@/components/status-badge";
import { auditActionLabel } from "@/lib/audit-presentation";
import { formatDateTime, fullName } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const applicationOrder = first(params.applicationOrder) === "oldest" ? "oldest" : "newest";
  const activityOrder = first(params.activityOrder) === "oldest" ? "oldest" : "newest";
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentYear = now.getUTCFullYear();
  const requestedYear = Number.parseInt(first(params.year), 10);
  const [rows, recentApplications, recentAudit, [{ activeTokenCount }], [{ monthCount }], [{ firstYear }]] =
    await Promise.all([
      db
        .select({ status: studentApplications.status, count: sql<number>`count(*)` })
        .from(studentApplications)
        .where(isNull(studentApplications.deletedAt))
        .groupBy(studentApplications.status),
      db
        .select()
        .from(studentApplications)
        .where(isNull(studentApplications.deletedAt))
        .orderBy(applicationOrder === "oldest" ? asc(studentApplications.createdAt) : desc(studentApplications.createdAt), desc(studentApplications.id))
        .limit(6),
      db
        .select({ log: auditLogs, admin: adminUsers })
        .from(auditLogs)
        .leftJoin(adminUsers, eq(adminUsers.id, auditLogs.adminUserId))
        .orderBy(activityOrder === "oldest" ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(8),
      db
        .select({ activeTokenCount: sql<number>`count(*)` })
        .from(applicationAccessTokens)
        .where(
          and(
            isNull(applicationAccessTokens.revokedAt),
            or(isNull(applicationAccessTokens.expiresAt), gt(applicationAccessTokens.expiresAt, now)),
          ),
        ),
      db
        .select({ monthCount: sql<number>`count(*)` })
        .from(studentApplications)
        .where(
          and(
            isNull(studentApplications.deletedAt),
            gte(studentApplications.createdAt, monthStart),
          ),
        ),
      db
        .select({ firstYear: sql<number | null>`MIN(YEAR(${studentApplications.createdAt}))` })
        .from(studentApplications)
        .where(isNull(studentApplications.deletedAt)),
    ]);

  const earliestYear = firstYear ? Math.min(Number(firstYear), currentYear) : currentYear;
  const year = Number.isFinite(requestedYear)
    ? Math.min(currentYear, Math.max(earliestYear, requestedYear))
    : currentYear;
  const yearRows = await db
    .select({
      month: sql<number>`MONTH(${studentApplications.createdAt})`,
      status: studentApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(studentApplications)
    .where(
      and(
        isNull(studentApplications.deletedAt),
        gte(studentApplications.createdAt, new Date(Date.UTC(year, 0, 1))),
        lt(studentApplications.createdAt, new Date(Date.UTC(year + 1, 0, 1))),
      ),
    )
    .groupBy(sql`MONTH(${studentApplications.createdAt})`, studentApplications.status);

  const months: AnalyticsMonth[] = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(Date.UTC(year, i, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    future: year === currentYear && i > now.getUTCMonth(),
    total: 0,
    byStatus: { claimed: 0, printed: 0, approved: 0, pending: 0, rejected: 0 },
  }));
  for (const r of yearRows) {
    const m = months[Number(r.month) - 1];
    if (!m) continue;
    m.byStatus[r.status] += Number(r.count);
    m.total += Number(r.count);
  }

  const counts = { total: 0, pending: 0, approved: 0, rejected: 0, printed: 0, claimed: 0 };
  for (const r of rows) {
    counts[r.status] = Number(r.count);
    counts.total += Number(r.count);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Page head */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
              <LayoutDashboard className="h-5 w-5" aria-hidden />
            </span>
            Dashboard
          </h1>
          <p className="text-muted text-sm mt-1">
            Operational overview of the ID issuance queue — from submission to collection.
          </p>
        </div>

        <Link href="/admin/qr" className="btn btn-gold btn-sm">
          <QrCode className="h-4 w-4" aria-hidden /> Generate Application QR
        </Link>
      </div>

      <IssuanceAnalytics
        counts={counts}
        monthCount={Number(monthCount)}
        year={year}
        earliestYear={earliestYear}
        currentYear={currentYear}
        months={months}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent applications */}
        <ListCard className="card overflow-hidden lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                <Layers className="h-3.5 w-3.5" aria-hidden />
              </span>
              Recent Applications
            </h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <ListLink
                href={`/admin?applicationOrder=${applicationOrder === "newest" ? "oldest" : "newest"}&activityOrder=${activityOrder}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]"
              >
                {applicationOrder === "newest" ? "Newest first" : "Oldest first"}
                <span className="text-[10px]" aria-hidden>{applicationOrder === "newest" ? "▼" : "▲"}</span>
              </ListLink>
              <Link
                href="/admin/applications"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]"
              >
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
          {recentApplications.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">
                <Layers className="h-7 w-7" aria-hidden />
              </div>
              <p className="font-bold text-base text-[var(--ink)]">No applications yet</p>
              <p className="text-muted mt-1 max-w-sm text-xs">
                Distribute the application QR code to start receiving student submissions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Control No.</th>
                    <th>Student</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApplications.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs font-bold text-[var(--academic-blue)] underline underline-offset-2">
                          {a.applicationCode}
                        </Link>
                      </td>
                      <td className="max-w-[220px] truncate font-semibold">{fullName(a)}</td>
                      <td className="whitespace-nowrap">{a.gradeLevel}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="text-muted whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ListCard>

        {/* Side column */}
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-muted text-[11px] font-bold uppercase tracking-wide">Active Application Links</h2>
                <p className="mt-1 text-3xl leading-none font-extrabold tabular-nums text-[var(--ink)]">
                  {Number(activeTokenCount)}
                </p>
              </div>
              <span className="dash-icon-chip" style={{ "--dash-accent": "var(--academic-blue)" } as CSSProperties}>
                <Link2 className="h-[18px] w-[18px]" aria-hidden />
              </span>
            </div>
            <p className="text-muted mt-3 text-xs leading-relaxed">
              QR access tokens currently usable by students.{" "}
              <Link href="/admin/qr" className="font-semibold text-[var(--academic-blue)] underline underline-offset-2">
                Manage
              </Link>
            </p>
          </section>

          <ListCard className="card flex-1 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                </span>
                Recent Activity
              </h2>
              <div className="flex flex-wrap items-center gap-2.5">
                <ListLink
                  href={`/admin?applicationOrder=${applicationOrder}&activityOrder=${activityOrder === "newest" ? "oldest" : "newest"}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]"
                >
                  {activityOrder === "newest" ? "Newest first" : "Oldest first"}
                  <span className="text-[10px]" aria-hidden>{activityOrder === "newest" ? "▼" : "▲"}</span>
                </ListLink>
                <Link
                  href="/admin/audit"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]"
                >
                  Audit log <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
            <ul>
              {recentAudit.map(({ log, admin }) => (
                <li key={log.id} className="border-b border-[var(--line)] px-5 py-2.5 last:border-b-0">
                  <p className="text-xs font-semibold text-[var(--ink)]">{auditActionLabel(log.action)}</p>
                  <p className="text-muted text-[11px]">
                    {admin ? admin.fullName : "Public / System"} · {formatDateTime(log.createdAt)}
                  </p>
                </li>
              ))}
              {recentAudit.length === 0 && (
                <li className="text-muted px-5 py-6 text-center text-sm">No recorded activity yet.</li>
              )}
            </ul>
          </ListCard>
        </div>
      </div>
    </div>
  );
}
