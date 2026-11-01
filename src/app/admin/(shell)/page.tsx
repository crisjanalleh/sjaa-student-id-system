import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { LayoutDashboard, QrCode } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { adminUsers, auditLogs, studentApplications } from "@/db/schema";
import GlobalSearch from "@/components/dashboard/global-search";
import {
  DashboardStatistics,
  NeedsAttention,
  RecentActivity,
  RecentApplications,
  SectionError,
  type DashboardCounts,
} from "@/components/dashboard/dashboard-sections";
import MonthlySubmissions, { type MonthBucket } from "@/components/dashboard/monthly-submissions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Philippine Standard Time is a fixed UTC+8 offset (no daylight saving). Timestamps are stored in UTC.
const PHT_OFFSET_HOURS = 8;
const PHT_OFFSET_MS = PHT_OFFSET_HOURS * 3_600_000;

function currentPhtDate() {
  return new Date(Date.now() + PHT_OFFSET_MS);
}

async function settle<T>(task: PromiseLike<T>): Promise<T | null> {
  try {
    return await task;
  } catch (error) {
    console.error("Dashboard section failed to load:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? "" : value ?? "");
  const applicationOrder = first(params.applicationOrder) === "oldest" ? "oldest" : "newest";

  // "Now" expressed on the Philippine calendar.
  const phtNow = currentPhtDate();
  const currentYear = phtNow.getUTCFullYear();
  const currentMonthIndex = phtNow.getUTCMonth();
  const requestedYear = Number.parseInt(first(params.year), 10);
  const localCreated = sql`DATE_ADD(${studentApplications.createdAt}, INTERVAL ${sql.raw(String(PHT_OFFSET_HOURS))} HOUR)`;

  const countsTask = settle(
    db
      .select({ status: studentApplications.status, count: sql<number>`count(*)` })
      .from(studentApplications)
      .where(isNull(studentApplications.deletedAt))
      .groupBy(studentApplications.status),
  );
  const recentTask = settle(
    db
      .select()
      .from(studentApplications)
      .where(isNull(studentApplications.deletedAt))
      .orderBy(
        applicationOrder === "oldest" ? asc(studentApplications.createdAt) : desc(studentApplications.createdAt),
        desc(studentApplications.id),
      )
      .limit(5),
  );
  const activityTask = settle(
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, adminName: adminUsers.fullName })
      .from(auditLogs)
      .leftJoin(adminUsers, eq(adminUsers.id, auditLogs.adminUserId))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(8),
  );
  const chartTask = settle(
    (async () => {
      const [{ firstYear }] = await db
        .select({ firstYear: sql<number | null>`MIN(YEAR(${localCreated}))` })
        .from(studentApplications)
        .where(isNull(studentApplications.deletedAt));
      const earliestYear = firstYear ? Math.min(Number(firstYear), currentYear) : currentYear;
      const year = Number.isFinite(requestedYear)
        ? Math.min(currentYear, Math.max(earliestYear, requestedYear))
        : currentYear;
      const rows = await db
        .select({ month: sql<number>`MONTH(${localCreated})`, count: sql<number>`count(*)` })
        .from(studentApplications)
        .where(
          and(
            isNull(studentApplications.deletedAt),
            gte(studentApplications.createdAt, new Date(Date.UTC(year, 0, 1) - PHT_OFFSET_MS)),
            lt(studentApplications.createdAt, new Date(Date.UTC(year + 1, 0, 1) - PHT_OFFSET_MS)),
          ),
        )
        .groupBy(sql`MONTH(${localCreated})`);
      const months: MonthBucket[] = MONTH_NAMES.map((name, i) => ({
        label: name.slice(0, 3),
        fullName: name,
        total: 0,
        future: year === currentYear && i > currentMonthIndex,
      }));
      for (const r of rows) {
        const bucket = months[Number(r.month) - 1];
        if (bucket) bucket.total += Number(r.count);
      }
      return { months, year, earliestYear };
    })(),
  );

  const [countRows, recent, activity, chart] = await Promise.all([countsTask, recentTask, activityTask, chartTask]);

  const counts: DashboardCounts | null = countRows
    ? countRows.reduce<DashboardCounts>(
        (acc, r) => {
          acc[r.status] = Number(r.count);
          acc.total += Number(r.count);
          return acc;
        },
        { total: 0, pending: 0, approved: 0, printed: 0, claimed: 0, rejected: 0 },
      )
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20 shadow-xs">
              <LayoutDashboard className="h-5 w-5" aria-hidden />
            </span>
            Dashboard
          </h1>
          <p className="text-muted mt-1 text-sm">
            Monitor student applications, manage ID issuance, and track collection progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GlobalSearch />
          <Link href="/admin/qr" className="btn btn-gold btn-sm">
            <QrCode className="h-4 w-4" aria-hidden /> Generate Application QR
          </Link>
        </div>
      </header>

      {counts ? (
        <>
          <NeedsAttention counts={counts} />
          <DashboardStatistics counts={counts} />
        </>
      ) : (
        <SectionError title="Application statistics" />
      )}

      {chart ? (
        <MonthlySubmissions months={chart.months} year={chart.year} earliestYear={chart.earliestYear} currentYear={currentYear} />
      ) : (
        <SectionError title="Monthly submissions" />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {recent ? <RecentApplications rows={recent} order={applicationOrder} /> : <div className="lg:col-span-2"><SectionError title="Recent applications" /></div>}
        {activity ? <RecentActivity rows={activity} /> : <SectionError title="Recent activity" />}
      </div>
    </div>
  );
}
