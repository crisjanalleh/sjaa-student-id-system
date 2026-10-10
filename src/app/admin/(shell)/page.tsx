import { and, asc, desc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import { LayoutDashboard, QrCode } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import {
  adminUsers,
  applicationAccessTokens,
  auditLogs,
  studentApplications,
} from "@/db/schema";
import IssuanceAnalytics, { type AnalyticsMonth } from "@/components/issuance-analytics";
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
  const claimedPercent = counts.total ? Math.round((counts.claimed / counts.total) * 100) : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2 font-extrabold">
            <LayoutDashboard className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
            Dashboard
          </h1>
          <p className="text-muted text-sm">Operational overview of the ID issuance queue.</p>
        </div>
        <Link href="/admin/qr" className="btn btn-gold btn-sm">
          <QrCode className="h-4 w-4" aria-hidden /> Generate Application QR
        </Link>
      </div>

      <IssuanceAnalytics
        counts={counts}
        monthCount={Number(monthCount)}
        claimedPercent={claimedPercent}
        year={year}
        earliestYear={earliestYear}
        currentYear={currentYear}
        months={months}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent applications */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
            <h2 className="text-sm font-bold">Recent Applications</h2>
            <div className="flex items-center gap-3">
              <Link href={`/admin?applicationOrder=${applicationOrder === "newest" ? "oldest" : "newest"}&activityOrder=${activityOrder}`} className="text-xs font-semibold no-underline" style={{ color: "var(--academic-blue)" }}>
                {applicationOrder === "newest" ? "Newest first ↓" : "Oldest first ↑"}
              </Link>
              <Link href="/admin/applications" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--academic-blue)" }}>
                View all
              </Link>
            </div>
          </div>
          {recentApplications.length === 0 ? (
            <p className="text-muted px-4 py-8 text-center text-sm">
              No applications yet. Distribute the application QR code to start receiving submissions.
            </p>
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
                        <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs font-bold underline underline-offset-2" style={{ color: "var(--academic-blue)" }}>
                          {a.applicationCode}
                        </Link>
                      </td>
                      <td className="max-w-[220px] truncate">{fullName(a)}</td>
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
        </section>

        {/* Side column */}
        <div className="flex flex-col gap-5">
          <section className="card p-4">
            <h2 className="lbl !mb-2">Active Application Links</h2>
            <p className="text-2xl font-extrabold tabular-nums">{Number(activeTokenCount)}</p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              QR access tokens currently usable by students.{" "}
              <Link href="/admin/qr" className="font-semibold underline underline-offset-2" style={{ color: "var(--academic-blue)" }}>
                Manage
              </Link>
            </p>
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
              <h2 className="text-sm font-bold">Recent Activity</h2>
              <div className="flex items-center gap-3">
                <Link href={`/admin?applicationOrder=${applicationOrder}&activityOrder=${activityOrder === "newest" ? "oldest" : "newest"}`} className="text-xs font-semibold no-underline" style={{ color: "var(--academic-blue)" }}>
                  {activityOrder === "newest" ? "Newest first ↓" : "Oldest first ↑"}
                </Link>
                <Link href="/admin/audit" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--academic-blue)" }}>
                  Audit log
                </Link>
              </div>
            </div>
            <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
              {recentAudit.map(({ log, admin }) => (
                <li key={log.id} className="px-4 py-2.5">
                  <p className="text-xs font-semibold">{auditActionLabel(log.action)}</p>
                  <p className="text-muted text-[11px]">
                    {admin ? admin.fullName : "Public / System"} · {formatDateTime(log.createdAt)}
                  </p>
                </li>
              ))}
              {recentAudit.length === 0 && (
                <li className="text-muted px-4 py-6 text-center text-sm">No recorded activity yet.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
