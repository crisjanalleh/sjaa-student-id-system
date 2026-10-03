import Link from "next/link";
import { QrCode, ShieldAlert, TimerReset } from "lucide-react";
import { getFormContext } from "@/lib/auth";
import { SCHOOL, config } from "@/lib/config";
import ApplyForm from "./apply-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Student ID Application" };

function BrandHeader() {
  return (
    <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--primary-navy)" }}>
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 text-white">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold tracking-wide"
          style={{ background: "var(--accent-gold)", color: "var(--primary-navy)" }}
          aria-hidden
        >
          SJ
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight">{SCHOOL.name}</p>
          <p className="truncate text-[11.5px] italic text-slate-300">
            {SCHOOL.motto} {SCHOOL.location} · Est. {SCHOOL.established}
          </p>
        </div>
      </div>
    </header>
  );
}

function AccessNotice({ reason }: { reason: string }) {
  const isExpired = reason === "expired";
  const Icon = isExpired ? TimerReset : ShieldAlert;
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--bg)" }}>
        <Icon className="h-6 w-6" style={{ color: "var(--danger)" }} aria-hidden />
      </div>
      <h1 className="text-lg font-bold">
        {isExpired ? "This application link has expired" : "A valid application link is required"}
      </h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        {isExpired
          ? "The QR code or link you used is no longer active. Please request a fresh application link from the Administration Office or your class adviser."
          : "The Student ID application form can only be opened through the official QR code or link distributed by the school. Please scan the QR code posted on campus or use the link shared through official school channels."}
      </p>
    </div>
  );
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ctx = await getFormContext();

  return (
    <div className="student-application-page min-h-screen">
      <BrandHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ctx ? (
          <ApplyForm
            csrfToken={ctx.csrfToken}
            tokenLabel={ctx.accessTokenLabel}
            privacyNotice={config.privacyNotice}
          />
        ) : (
          <>
            <AccessNotice reason={error || "invalid"} />
            <p className="text-muted mt-6 flex items-center justify-center gap-2 text-center text-xs">
              <QrCode className="h-4 w-4" aria-hidden />
              Application links are generated and distributed by the SJAA Administration Office.
            </p>
          </>
        )}
        <footer className="text-muted mt-10 border-t pt-4 text-center text-[11px]" style={{ borderColor: "var(--line)" }}>
          {SCHOOL.name} · Student ID Issuance System ·{" "}
          <Link href="/" className="underline underline-offset-2">
            Home
          </Link>
        </footer>
      </main>
    </div>
  );
}
