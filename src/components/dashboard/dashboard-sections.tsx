import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  IdCard,
  Layers,
  Link2,
  LogIn,
  PackageCheck,
  Printer,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import StatusBadge from "@/components/status-badge";
import ClickableRow from "@/components/clickable-row";
import SortIcon from "@/components/sort-icon";
import { auditActionLabel, auditActionTone, type AuditTone } from "@/lib/audit-presentation";
import { formatDateTime, fullName } from "@/lib/format";
import { APPLICATION_STATUSES } from "@/lib/fields";

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type DashboardCounts = {
  total: number;
  pending: number;
  approved: number;
  printed: number;
  claimed: number;
  rejected: number;
};

const nf = (n: number) => n.toLocaleString("en-US");

export type DashboardInsights = {
  thisMonth: number;
  lastMonth: number;
  oldestPendingDays: number | null;
};

const plural = (n: number, word: string) => `${nf(n)} ${word}${n === 1 ? "" : "s"}`;

export function SectionError({ title }: { title: string }) {
  return (
    <section className="card p-5" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[var(--ink)]">{title} is temporarily unavailable</h2>
          <p className="text-muted mt-1 text-xs">This section could not be loaded. The rest of the dashboard is unaffected.</p>
        </div>
        <Link href="/admin" className="btn btn-outline btn-sm" prefetch={false}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Link>
      </div>
    </section>
  );
}

function SectionHead({ icon: Icon, title, id, children }: { icon: LucideIcon; title: string; id?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-nowrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--card)]/60 px-4 py-3.5 sm:px-5">
      <h2 id={id} className="flex min-w-0 items-center gap-2 whitespace-nowrap text-sm font-bold text-[var(--ink)]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="truncate">{title}</span>
      </h2>
      {children && <div className="flex shrink-0 flex-nowrap items-center gap-2">{children}</div>}
    </div>
  );
}

const pillLink =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]";

/* ----------------------------- KPI cards ----------------------------- */

export function DashboardStatistics({ counts, insights }: { counts: DashboardCounts; insights: DashboardInsights | null }) {
  const handedOut = counts.printed + counts.claimed;
  const claimRate = handedOut > 0 ? Math.round((counts.claimed / handedOut) * 100) : null;
  const trend = insights ? insights.thisMonth - insights.lastMonth : 0;
  const totalHint = insights
    ? `${plural(insights.thisMonth, "new application")} this month${
        insights.lastMonth > 0 || insights.thisMonth > 0
          ? trend === 0
            ? " · same as last month"
            : ` · ${trend > 0 ? "up" : "down"} ${nf(Math.abs(trend))} from last month`
          : ""
      }.`
    : "All recorded applications.";
  const pendingHint =
    counts.pending === 0
      ? "Nothing waiting. The review queue is clear."
      : insights?.oldestPendingDays != null
        ? insights.oldestPendingDays === 0
          ? "Oldest was submitted today."
          : `Oldest has waited ${plural(insights.oldestPendingDays, "day")}.`
        : "Awaiting administrator approval.";
  const cards: { label: string; value: number; hint: string; Icon: LucideIcon; accent: string; href: string }[] = [
    { label: "Total applications", value: counts.total, hint: totalHint, Icon: Users, accent: "var(--academic-blue)", href: "/admin/applications" },
    { label: "Pending review", value: counts.pending, hint: pendingHint, Icon: ClipboardList, accent: "var(--st-pending)", href: "/admin/applications?status=pending" },
    { label: "Ready to print", value: counts.approved, hint: counts.approved === 0 ? "No approved applications are waiting." : "Approved and waiting for a print batch.", Icon: Printer, accent: "var(--st-approved)", href: "/admin/print" },
    {
      label: "IDs claimed",
      value: counts.claimed,
      hint: claimRate === null ? "No IDs have been printed yet." : `${claimRate}% of ${plural(handedOut, "printed ID")} collected.`,
      Icon: PackageCheck,
      accent: "var(--st-claimed)",
      href: "/admin/applications?status=claimed",
    },
  ];
  return (
    <section aria-label="Application statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, hint, Icon, accent, href }) => (
        <Link
          key={label}
          href={href}
          className="card group flex items-start gap-3.5 p-4 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="text-muted block text-[11px] font-bold uppercase tracking-wide">{label}</span>
            <span className="mt-1 block text-3xl font-extrabold leading-none tabular-nums text-[var(--ink)]">{nf(value)}</span>
            <span className="text-muted mt-1.5 block text-xs leading-snug">{hint}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

/* --------------------------- Status pipeline --------------------------- */

/* --------------------------- Needs attention --------------------------- */

export function NeedsAttention({ counts }: { counts: DashboardCounts }) {
  const items: { count: number; message: string; action: string; href: string; Icon: LucideIcon; tone: string }[] = [
    { count: counts.pending, message: "awaiting review", action: "Review applications", href: "/admin/applications?status=pending", Icon: ClipboardList, tone: "pending" },
    { count: counts.approved, message: "ready for batch printing", action: "Open Batch Print", href: "/admin/print", Icon: Printer, tone: "approved" },
    { count: counts.printed, message: "awaiting collection", action: "View printed IDs", href: "/admin/applications?status=printed", Icon: IdCard, tone: "printed" },
    { count: counts.rejected, message: "need correction or resubmission", action: "View rejected", href: "/admin/applications?status=rejected", Icon: XCircle, tone: "rejected" },
  ];
  const open = items.filter((i) => i.count > 0);

  return (
    <section
      className="card overflow-hidden"
      aria-labelledby="attention-title"
      style={open.length > 0 ? { borderColor: "color-mix(in srgb, var(--st-pending) 45%, var(--line))", boxShadow: "inset 0 3px 0 var(--st-pending)" } : undefined}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5 sm:px-5"
        style={open.length > 0 ? { background: "color-mix(in srgb, var(--st-pending) 9%, var(--card))" } : undefined}
      >
        <h2 id="attention-title" className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-[var(--ink)]">
          <span
            className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ color: "var(--st-pending)", background: "color-mix(in srgb, var(--st-pending) 18%, transparent)" }}
          >
            {open.length > 0 && <span className="attention-ping absolute inset-0 rounded-full" aria-hidden />}
            <TriangleAlert className="relative h-4 w-4" aria-hidden />
          </span>
          Needs attention
        </h2>
        {open.length > 0 && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ color: "var(--st-pending)", background: "color-mix(in srgb, var(--st-pending) 16%, transparent)" }}
          >
            {open.length} {open.length === 1 ? "task" : "tasks"} open
          </span>
        )}
      </div>
      {open.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm font-semibold" style={{ color: "var(--success)" }}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> You&rsquo;re all caught up. No action is required right now.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2.5 p-3 sm:px-4">
          {open.map(({ count, message, href, Icon, tone }) => (
            <li key={tone} className="min-w-0 max-w-full">
              <Link
                href={href}
                title={message}
                className="group relative flex max-w-full items-center gap-2.5 overflow-hidden rounded-lg border py-2 pl-4 pr-3 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  borderColor: `color-mix(in srgb, var(--st-${tone}) 35%, var(--line))`,
                  background: `color-mix(in srgb, var(--st-${tone}) 7%, var(--card))`,
                }}
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: `var(--st-${tone})` }} aria-hidden />
                <Icon className="h-4 w-4 shrink-0" style={{ color: `var(--st-${tone})` }} aria-hidden />
                <span className="text-lg font-extrabold leading-none tabular-nums text-[var(--ink)]">{nf(count)}</span>
                <span className="text-muted text-xs leading-tight">{message}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: `var(--st-${tone})` }} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------- Recent applications --------------------------- */

type RecentApp = {
  id: number;
  applicationCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  gradeLevel: string;
  status: ApplicationStatus;
  createdAt: Date;
};

export function RecentApplications({ rows, order }: { rows: RecentApp[]; order: "newest" | "oldest" }) {
  return (
    <section className="card overflow-hidden lg:col-span-2" aria-labelledby="recent-apps-title">
      <SectionHead icon={Layers} title="Recent applications" id="recent-apps-title">
        <Link href={`/admin?applicationOrder=${order === "newest" ? "oldest" : "newest"}`} className={pillLink} scroll={false}>
          {order === "newest" ? "Newest" : "Oldest"} first <SortIcon active dir={order === "newest" ? "desc" : "asc"} />
        </Link>
        <Link href="/admin/applications" className={pillLink}>
          View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </SectionHead>
      {rows.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty-icon"><Layers className="h-7 w-7" aria-hidden /></div>
          <p className="text-base font-bold text-[var(--ink)]">No applications yet</p>
          <p className="text-muted mt-1 max-w-sm text-xs">
            Share an application QR code with students to start receiving submissions.{" "}
            <Link href="/admin/qr" className="font-semibold text-[var(--academic-blue)] underline underline-offset-2">Generate QR</Link>
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
              {rows.map((a) => (
                <ClickableRow key={a.id} href={`/admin/applications/${a.id}`} label={`Open application ${a.applicationCode}`}>
                  <td className="whitespace-nowrap font-mono text-xs font-bold text-[var(--ink)]">{a.applicationCode}</td>
                  <td className="max-w-[200px] truncate font-semibold">{fullName(a)}</td>
                  <td className="whitespace-nowrap">{a.gradeLevel}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className="text-muted whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Recent activity ------------------------------ */

type ActivityRow = {
  id: number;
  action: string;
  createdAt: Date;
  adminName: string | null;
};

function activityIcon(action: string): LucideIcon {
  if (action.startsWith("auth.")) return LogIn;
  if (action.startsWith("token.")) return Link2;
  if (action.startsWith("batch.")) return Printer;
  if (action === "application.claimed") return PackageCheck;
  if (action === "application.rejected") return XCircle;
  if (action === "application.approved") return CheckCircle2;
  if (action.startsWith("application.")) return ClipboardList;
  if (action.startsWith("admin.")) return UserCog;
  if (action.startsWith("template.")) return FileText;
  if (action.startsWith("notification.")) return ShieldCheck;
  return Activity;
}

const TONE_COLOR: Record<AuditTone, string> = {
  approved: "var(--st-approved)",
  pending: "var(--st-pending)",
  rejected: "var(--st-rejected)",
  printed: "var(--st-printed)",
  claimed: "var(--st-claimed)",
  neutral: "var(--muted)",
};

export function RecentActivity({ rows }: { rows: ActivityRow[] }) {
  return (
    <section className="card flex flex-col overflow-hidden" aria-labelledby="recent-activity-title">
      <SectionHead icon={Activity} title="Recent activity" id="recent-activity-title">
        <Link href="/admin/audit" className={pillLink}>
          Audit log <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </SectionHead>
      {rows.length === 0 ? (
        <p className="text-muted px-5 py-8 text-center text-sm">No administrative activity has been recorded yet.</p>
      ) : (
        <ul className="flex-1">
          {rows.map((row) => {
            const Icon = activityIcon(row.action);
            const color = TONE_COLOR[auditActionTone(row.action)];
            return (
              <li key={row.id} className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0 sm:px-5">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--ink)]">{auditActionLabel(row.action)}</p>
                  <p className="text-muted truncate text-[11px]">
                    {row.adminName ?? "Public / System"} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
