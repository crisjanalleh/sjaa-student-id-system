import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  Camera,
  ChevronRight,
  ClipboardList,
  Clock,
  ImageOff,
  Mail,
  Phone,
  ScrollText,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  adminUsers,
  auditLogs,
  notificationLogs,
  printBatchItems,
  printBatches,
  studentApplications,
} from "@/db/schema";
import StatusBadge from "@/components/status-badge";
import { getAdminContext } from "@/lib/auth";
import { friendlyDeliveryError } from "@/lib/delivery-error";
import { auditActionLabel, auditDetails } from "@/lib/audit-presentation";
import { formatDateTime, fullName, maskEmail } from "@/lib/format";
import ApplicationActions from "./application-actions";
import EditDetailsForm from "./edit-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Application Detail" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const ctx = await getAdminContext();
  if (!ctx) notFound(); // layout guard normally handles this first

  const rows = await db
    .select({ app: studentApplications, reviewer: adminUsers })
    .from(studentApplications)
    .leftJoin(adminUsers, eq(adminUsers.id, studentApplications.reviewedByAdminId))
    .where(and(eq(studentApplications.id, id), isNull(studentApplications.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const app = row.app;
  const claimAdminRows = app.claimedByAdminId
    ? await db
        .select({ fullName: adminUsers.fullName })
        .from(adminUsers)
        .where(eq(adminUsers.id, app.claimedByAdminId))
        .limit(1)
    : [];
  const claimAdminName = claimAdminRows[0]?.fullName ?? null;
  const batchRows = await db
    .select({ batchCode: printBatches.batchCode, printedAt: printBatches.printedAt })
    .from(printBatchItems)
    .innerJoin(printBatches, eq(printBatches.id, printBatchItems.batchId))
    .where(eq(printBatchItems.applicationId, app.id))
    .limit(1);
  const batchQueued = app.status === "approved" && Boolean(batchRows[0]) && !batchRows[0].printedAt;

  const history = await db
    .select({ log: auditLogs, admin: adminUsers })
    .from(auditLogs)
    .leftJoin(adminUsers, eq(adminUsers.id, auditLogs.adminUserId))
    .where(
      and(
        eq(auditLogs.entityType, "application"),
        or(eq(auditLogs.entityId, String(app.id)), eq(auditLogs.entityId, app.applicationCode)),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  const notifications = await db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.applicationId, app.id))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(20);

  const info = (label: string, value: React.ReactNode, wide = false) => (
    <div className={`rounded-xl border border-[var(--line)] bg-[var(--bg)]/50 px-3.5 py-2.5 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-muted text-[10.5px] font-bold uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--ink)]">{value || <span className="text-muted font-normal">—</span>}</dd>
    </div>
  );
  const group = (title: string, Icon: typeof User, children: React.ReactNode) => (
    <div>
      <h3 className="text-muted mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </h3>
      <dl className="grid gap-2.5 sm:grid-cols-2">{children}</dl>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted" aria-label="Breadcrumb">
          <Link href="/admin" className="transition-colors hover:text-[var(--ink)]">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <Link href="/admin/applications" className="transition-colors hover:text-[var(--ink)]">Applications</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
          <span className="font-semibold text-[var(--ink)]">{app.applicationCode}</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)] shadow-xs ring-1 ring-[var(--academic-blue)]/20">
                <ClipboardList className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-mono">{app.applicationCode}</span>
            </h1>
            <p className="text-muted mt-1 text-sm">
              Submitted {formatDateTime(app.createdAt)}
              {app.reviewedAt && ` · Reviewed ${formatDateTime(app.reviewedAt)}${row.reviewer ? ` by ${row.reviewer.fullName}` : ""}`}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>
      </div>

      <ApplicationActions
        id={app.id}
        status={app.status}
        csrfToken={ctx.csrfToken}
        hasPhoto={Boolean(app.photoStorageKey)}
        applicationCode={app.applicationCode}
        studentName={fullName(app)}
        studentIdNumber={app.studentIdNumber}
        batchQueued={batchQueued}
        batchCode={batchRows[0]?.batchCode ?? null}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Photo review column */}
        <div className="lg:col-span-2">
          <section className="card overflow-hidden">
            <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--line)" }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                <Camera className="h-3.5 w-3.5" aria-hidden />
              </span>
              Photo Review
            </h2>
            <div className="p-4">
            <div
              className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border"
              style={{ borderColor: "var(--line)", background: "var(--bg)" }}
            >
              {app.photoStorageKey ? (
                // Authenticated stream — no predictable public URL exists.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/admin/applications/${app.id}/photo`}
                  alt={`ID photo for ${fullName(app)}`}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="text-center">
                  <ImageOff className="mx-auto mb-2 h-8 w-8" style={{ color: "var(--muted)" }} aria-hidden />
                  <p className="text-muted text-xs font-semibold">No photo submitted</p>
                </div>
              )}
            </div>
            {app.studentSignatureDataUrl && (
              <div className="mt-3 rounded-md border p-3" style={{ borderColor: "var(--line)" }}>
                <p className="lbl !mb-2">Student signature on file</p>
                {/* This student-provided signature is shown only in the authenticated admin record. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={app.studentSignatureDataUrl}
                  alt={`Student signature for ${fullName(app)}`}
                  className="h-16 w-full object-contain"
                />
              </div>
            )}
            {app.status === "rejected" && app.rejectionReason && (
              <div
                className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs"
                style={{ borderColor: "var(--danger)" }}
                role="note"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
                <div>
                  <p className="font-bold" style={{ color: "var(--danger)" }}>
                    Rejection reason
                  </p>
                  <p className="mt-0.5 leading-relaxed">{app.rejectionReason}</p>
                </div>
              </div>
            )}
            </div>
          </section>
        </div>

        {/* Details column */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <section className="card overflow-hidden">
            <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--line)" }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                <User className="h-3.5 w-3.5" aria-hidden />
              </span>
              Student Information
            </h2>
            <div className="space-y-5 p-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--academic-blue)]/[0.06] px-4 py-3.5">
                <p className="text-muted text-[10.5px] font-bold uppercase tracking-wider">Full Name</p>
                <p className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-[var(--ink)]">{fullName(app)}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {app.gradeLevel && (
                    <span className="rounded-full border border-[var(--line)] bg-[var(--card)] px-2.5 py-1">{app.gradeLevel}</span>
                  )}
                  {app.trackStrand && (
                    <span className="rounded-full border border-[var(--line)] bg-[var(--card)] px-2.5 py-1">{app.trackStrand}</span>
                  )}
                  <span className="rounded-full border border-[var(--line)] bg-[var(--card)] px-2.5 py-1 font-mono">
                    LRN {app.studentIdNumber}
                  </span>
                </div>
              </div>

              {group("Contact", Mail, <>
                {info("Email", app.email ? <span className="break-all">{app.email}</span> : null)}
                {info("Contact No.", app.contactNumber)}
                {info("Address", app.address, true)}
              </>)}

              {group("Emergency Contact", Phone, <>
                {info("Name", app.emergencyContactName)}
                {info("Phone", app.emergencyContactPhone)}
              </>)}

              {group("Record", Clock, <>
                {info("Control No.", <span className="font-mono text-xs font-bold">{app.applicationCode}</span>)}
                {info("Last Updated", <span className="text-xs">{formatDateTime(app.updatedAt)}</span>)}
                {app.printedAt && info("Printed At", <span className="text-xs">{formatDateTime(app.printedAt)}</span>)}
                {app.claimedAt && info("ID Claimed", <span className="text-xs">{formatDateTime(app.claimedAt)}{claimAdminName ? ` · ${claimAdminName}` : ""}</span>)}
              </>)}
            </div>
          </section>

          {(app.status === "pending" || app.status === "rejected") && (
            <EditDetailsForm
              id={app.id}
              csrfToken={ctx.csrfToken}
              initial={{
                studentIdNumber: app.studentIdNumber,
                firstName: app.firstName,
                middleName: app.middleName || "",
                lastName: app.lastName,
                suffix: app.suffix || "",
                address: app.address,
                gradeLevel: app.gradeLevel,
                trackStrand: app.trackStrand || "",
                email: app.email || "",
                contactNumber: app.contactNumber || "",
                emergencyContactName: app.emergencyContactName,
                emergencyContactPhone: app.emergencyContactPhone,
              }}
            />
          )}

          <section className="card">
            <h2 className="border-b px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--line)" }}>
              Notification History
            </h2>
            {notifications.length === 0 ? (
              <p className="text-muted px-4 py-6 text-center text-sm">No notifications recorded for this application.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
                {notifications.map((n) => (
                  <li key={n.id} className="px-4 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">
                        {n.notificationType === "rejection_notice" ? "Rejection notice" : "Ready for claiming"}
                      </span>
                      <span
                        className={`badge ${
                          n.sentStatus === "sent"
                            ? "badge-approved"
                            : n.sentStatus === "failed"
                              ? "badge-rejected"
                              : "badge-pending"
                        }`}
                      >
                        {n.sentStatus}
                      </span>
                    </div>
                    <p className="text-muted mt-1">
                      To {maskEmail(n.recipientEmail)} · {formatDateTime(n.createdAt)}
                      {n.sentAt ? ` · sent ${formatDateTime(n.sentAt)}` : ""}
                      {n.attempts > 1 ? ` · ${n.attempts} attempts` : ""}
                    </p>
                    {n.sentStatus === "sent" && (
                      <p className="mt-1 text-[11px] font-medium" style={{ color: n.acknowledgedAt ? "var(--success)" : "var(--muted)" }}>
                        {n.acknowledgedAt ? `Student acknowledged receipt on ${formatDateTime(n.acknowledgedAt)}.` : "Awaiting student acknowledgement."}
                      </p>
                    )}
                    {n.error && <p className="mt-1 leading-relaxed" style={{ color: "var(--danger)" }}>{friendlyDeliveryError(n.error)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--line)" }}>
              <ScrollText className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
              Review History
            </h2>
            {history.length === 0 ? (
              <p className="text-muted px-4 py-6 text-center text-sm">No recorded events yet.</p>
            ) : (
              <ol className="relative ml-5 px-4 py-4" style={{ borderLeft: "2px solid var(--line)" }}>
                {history.map(({ log, admin }) => (
                  <li key={log.id} className="relative pb-4 pl-4 last:pb-0">
                    <span
                      className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full"
                      style={{ background: "var(--accent-gold)", border: "2px solid var(--card)" }}
                      aria-hidden
                    />
                    <p className="text-xs font-bold">{auditActionLabel(log.action)}</p>
                    <p className="text-muted text-[11px]">
                      {admin ? admin.fullName : "Student / System"} · {formatDateTime(log.createdAt)}
                    </p>
                    {auditDetails(log.action, log.metadataJson) && (
                      <p className="text-muted mt-0.5 break-words text-[11px] leading-relaxed">
                        {auditDetails(log.action, log.metadataJson)}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
