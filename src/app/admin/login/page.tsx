import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAdminContext } from "@/lib/auth";
import { SCHOOL } from "@/lib/config";
import LoginForm from "./login-form";
import SjaaLogo from "@/components/sjaa-logo";
import DeviceTheme from "./device-theme";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administrator Sign In" };

export default async function AdminLoginPage() {
  const ctx = await getAdminContext();
  if (ctx) redirect("/admin");

  return (
    <div
      className="flex min-h-screen flex-col justify-between items-center px-4 py-8 sm:py-10"
      style={{
        background: "radial-gradient(ellipse at 15% 10%, rgba(229,168,35,.22), transparent 32%), linear-gradient(145deg, #0b1426 0%, #1b2a4a 58%, #254e70 100%)",
      }}
    >
      <div className="w-full flex-1 flex items-center justify-center">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl md:grid-cols-[1.05fr_0.95fr]" style={{ borderColor: "rgba(255,255,255,.16)", boxShadow: "0 28px 80px rgba(0,0,0,.32)" }}>
          <section className="relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex" style={{ background: "linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.015))" }}>
            <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full border" style={{ borderColor: "rgba(229,168,35,.22)" }} aria-hidden />
            <div className="absolute -right-8 -top-4 h-40 w-40 rounded-full border" style={{ borderColor: "rgba(229,168,35,.2)" }} aria-hidden />
            <div className="relative flex flex-col items-center text-center">
              <SjaaLogo className="mb-8 h-36 w-36 object-contain drop-shadow-xl" priority />
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#f0c75e" }}>Administration workspace</p>
              <h1 className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight">{SCHOOL.name}</h1>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
                Manage student applications, prepare ID batches, and keep issuance records in one secure workspace.
              </p>
            </div>
            <div className="relative border-t pt-5 text-center text-xs leading-relaxed text-slate-300" style={{ borderColor: "rgba(255,255,255,.15)" }}>
              <p className="font-semibold text-white">{SCHOOL.motto}</p>
              <p className="mt-1">{SCHOOL.address}</p>
              <p>Est. {SCHOOL.established}</p>
            </div>
          </section>
          <section className="relative flex items-center px-6 py-9 sm:px-10" style={{ background: "var(--card)", color: "var(--ink)" }}>
            <div className="w-full">
              <DeviceTheme />
              <div className="mb-7 text-center md:hidden">
                <SjaaLogo className="mx-auto mb-3 h-24 w-24 object-contain" />
                <p className="text-sm font-bold">{SCHOOL.name}</p>
                <p className="text-muted mt-1 text-xs">{SCHOOL.address}</p>
              </div>
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">Administrator sign in</h2>
                  <p className="text-muted mt-0.5 text-sm">Welcome back. Enter your account details.</p>
                </div>
              </div>
              <LoginForm />
              <div className="text-muted mt-6 border-t pt-4 text-[11px] leading-relaxed" style={{ borderColor: "var(--line)" }}>
                Authorized personnel only. Sign-in activity is rate-limited and recorded in the audit log.
              </div>
            </div>
          </section>
        </div>
      </div>
      <footer className="no-print mt-6 text-center text-xs text-slate-300/80">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-medium">
          <span>Authorized Staff Only</span>
          <span className="opacity-40" aria-hidden>|</span>
          <span>{SCHOOL.address}</span>
          <span className="opacity-40" aria-hidden>|</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
