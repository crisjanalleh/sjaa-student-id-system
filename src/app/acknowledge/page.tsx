import { and, eq } from "drizzle-orm";
import { CheckCircle2, MailCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { SCHOOL } from "@/lib/config";
import { sha256Hex } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acknowledge Email Receipt",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AcknowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const validToken = typeof token === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(token);
  const rows = validToken
    ? await db
        .select({
          acknowledgedAt: notificationLogs.acknowledgedAt,
        })
        .from(notificationLogs)
        .where(and(
          eq(notificationLogs.acknowledgementTokenHash, sha256Hex(token)),
          eq(notificationLogs.sentStatus, "sent"),
        ))
        .limit(1)
    : [];
  const alreadyAcknowledged = rows[0]?.acknowledgedAt;
  const showSuccess = Boolean(alreadyAcknowledged);
  const showForm = Boolean(rows[0] && !alreadyAcknowledged && validToken);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10">
      <section className="card w-full overflow-hidden">
        <div className="h-1" style={{ background: "var(--accent-gold)" }} />
        <div className="p-6 sm:p-8">
          <p className="text-muted mb-2 text-xs font-bold uppercase tracking-[0.1em]">{SCHOOL.name}</p>
          {showSuccess ? (
            <>
              <CheckCircle2 className="mb-4 h-9 w-9" style={{ color: "var(--success)" }} aria-hidden />
              <h1 className="text-xl font-extrabold">Email receipt acknowledged</h1>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Thank you. Your receipt confirmation has been recorded for the school. This confirms only that the email was received; it does not change your application status or confirm that an ID card has been collected.
              </p>
            </>
          ) : showForm ? (
            <>
              <MailCheck className="mb-4 h-9 w-9" style={{ color: "var(--academic-blue)" }} aria-hidden />
              <h1 className="text-xl font-extrabold">Confirm email receipt</h1>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Select the button below to let the school know you received and read the Student ID notification. This confirmation does not change your application status and, if the message says your card is ready, does not mean that the card has been collected.
              </p>
              <form action="/api/notifications/acknowledge" method="POST" className="mt-6">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="confirm" value="received" />
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Confirm receipt
                </button>
              </form>
            </>
          ) : (
            <>
              <TriangleAlert className="mb-4 h-9 w-9" style={{ color: "var(--danger)" }} aria-hidden />
              <h1 className="text-xl font-extrabold">This acknowledgement link is unavailable</h1>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                The link may be invalid or the notification may not have been delivered. If you need help, contact the school through its usual channels.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
