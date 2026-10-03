import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  ArrowLeft,
  Camera,
  ClipboardList,
  ImageOff,
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

  const info = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="lbl !mb-0.5">{label}</dt>
      <dd className="text-sm font-medium">{value || <span className="text-muted">—</span>}</dd>
    </div>
  );

  return (
    <div>
      <Link href="/admin/applications" className="text-muted mb-4 inline-flex items-center gap-1.5 text-xs font-semibold no-underline hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to queue
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-xl font-extrabold tracking-tight">
            <ClipboardList className="h-5 w-5 shrink-0" style={{ color: "var(--academic-blue)" }} aria-hidden />
            {app.applicationCode}
          </h1>
          <p className="text-muted text-xs">
            Submitted {formatDateTime(app.createdAt)}
            {app.reviewedAt && ` · Reviewed ${formatDateTime(app.reviewedAt)}${row.reviewer ? ` by ${row.reviewer.fullName}` : ""}`}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Photo review column */}
        <div className="lg:col-span-2">
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Camera className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
              Photo Review
            </h2>
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
          </section>

          <ApplicationActions
            id={app.id}
            status={app.status}
            csrfToken={ctx.csrfToken}
            hasPhoto={Boolean(app.photoStorageKey)}
          />
        </div>

        {/* Details column */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <User className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
              Student Information
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {info("Control No.", <span className="font-mono text-xs font-bold">{app.applicationCode}</span>)}
              {info("Student ID / LRN", <span className="font-mono text-xs">{app.studentIdNumber}</span>)}
              {info("Full Name", fullName(app))}
              {info("Grade Level", app.gradeLevel)}
              {info("Track / Strand", app.trackStrand)}
              {info("Blood Type", app.bloodType)}
              {info("Address", app.address)}
              {info("Email", app.email ? <span className="break-all">{app.email}</span> : null)}
              {info("Contact No.", app.contactNumber)}
              {info("Emergency Contact", app.emergencyContactName)}
              {info("Emergency Phone", app.emergencyContactPhone)}
              {info("Last Updated", <span className="text-xs">{formatDateTime(app.updatedAt)}</span>)}
            </dl>
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
                bloodType: app.bloodType || "",
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
