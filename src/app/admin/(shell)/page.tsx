import { and, asc, desc, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
import { LayoutDashboard, QrCode } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import {
  adminUsers,
  applicationAccessTokens,
  auditLogs,
  studentApplications,
} from "@/db/schema";
import StatusBadge from "@/components/status-badge";
import { auditActionLabel, auditActionStyle } from "@/lib/audit-presentation";
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
  const [rows, recentApplications, recentAudit, [{ activeTokenCount }], [{ monthCount }]] =
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
    ]);

  const counts: Record<string, number> = {
    total: 0, pending: 0, approved: 0, rejected: 0, printed: 0, claimed: 0,
  };
  for (const r of rows) {
    counts[r.status] = Number(r.count);
    counts.total += Number(r.count);
  }
  const claimedPercent = counts.total ? Math.round((counts.claimed / counts.total) * 100) : 0;
  const statusBreakdown = [
    { key: "pending", label: "Pending review", color: "#d97706", description: "Needs review", action: true },
    { key: "approved", label: "Approved", color: "#16a34a", description: "Ready to print", action: true },
    { key: "printed", label: "Printed", color: "#2563eb", description: "Awaiting collection", action: false },
    { key: "claimed", label: "ID Claimed", color: "#64748b", description: "Complete", action: false },
    { key: "rejected", label: "Not approved", color: "#dc2626", description: "Closed", action: false },
  ] as const;
  let chartOffset = 0;
  const chartSegments = statusBreakdown.map(({ key, color }) => {
    const percentage = counts.total ? (counts[key] / counts.total) * 100 : 0;
    const segment = { key, color, start: chartOffset, end: chartOffset + percentage };
    chartOffset += percentage;
    return segment;
  });
  const chartBackground = counts.total
    ? `conic-gradient(from -90deg, ${chartSegments.map(({ color, start, end }) => `${color} ${start}% ${end}%`).join(", ")})`
    : "var(--line)";
  const chartDescription = counts.total
    ? `Status distribution: ${statusBreakdown.map(({ key, label }) => `${label} ${counts[key]}`).join(", ")}`
    : "Application status distribution: no applications yet";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <LayoutDashboard className="h-5 w-5" style={{ color: "var(--academic-blue)" }} aria-hidden />
            Dashboard
          </h1>
          <p className="text-muted text-sm">Operational overview of the ID issuance queue.</p>
        </div>
        <Link href="/admin/qr" className="btn btn-gold btn-sm">
          <QrCode className="h-4 w-4" aria-hidden /> Generate Application QR
        </Link>
      </div>

      <section className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <div>
            <h2 className="text-sm font-bold">ID issuance overview</h2>
            <p className="text-muted mt-1 text-xs">Select a status to open its application records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/admin/applications" className="no-underline">
              <span className="text-muted block text-[11px] font-semibold uppercase tracking-wide">All applications</span>
              <span className="text-xl font-extrabold tabular-nums">{counts.total}</span>
            </Link>
            <div>
              <span className="text-muted block text-[11px] font-semibold uppercase tracking-wide">Received this month</span>
              <span className="text-xl font-extrabold tabular-nums">{Number(monthCount)}</span>
            </div>
            <div>
              <span className="text-muted block text-[11px] font-semibold uppercase tracking-wide">Cards collected</span>
              <span className="text-xl font-extrabold tabular-nums">{claimedPercent}%</span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid items-center gap-6 md:grid-cols-[minmax(180px,0.75fr)_minmax(0,1.5fr)]">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold">Application status distribution</p>
              <div
                className="h-44 w-44 rounded-full shadow-sm ring-1 ring-[var(--line)]"
                role="img"
                aria-label={chartDescription}
                style={{ background: chartBackground }}
              >
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {statusBreakdown.map(({ key, label, color, description, action }) => {
                const count = counts[key];
                const percent = counts.total ? Math.round((count / counts.total) * 100) : 0;
                return (
                  <Link
                    key={key}
                    href={`/admin/applications?status=${key}`}
                    className="flex min-h-12 items-center gap-3 py-2.5 no-underline transition-colors hover:bg-[var(--bg)]"
                    aria-label={`${label}: ${count} records, ${percent} percent. ${count > 0 && action ? "Action needed." : description}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold">{label}</span>
                      <span className="text-muted block text-[10px]">{description}</span>
                    </span>
                    {action && count > 0 && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: "#fff7ed", color: "#9a3412" }}>
                        Action needed
                      </span>
                    )}
                    <span className="w-10 text-right text-sm font-bold tabular-nums">{count}</span>
                    <span className="text-muted w-11 text-right text-xs tabular-nums">{percent}%</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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
