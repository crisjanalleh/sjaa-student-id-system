import { redirect } from "next/navigation";
import { ClipboardCheck, Printer, ShieldCheck } from "lucide-react";
import { getAdminContext } from "@/lib/auth";
import { SCHOOL } from "@/lib/config";
import LoginForm from "./login-form";
import SjaaLogo from "@/components/sjaa-logo";
import DeviceTheme from "./device-theme";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administrator Sign In" };

const HIGHLIGHTS = [
  { Icon: ClipboardCheck, text: "Review and approve student applications" },
  { Icon: Printer, text: "Prepare ID batches and track printing" },
  { Icon: ShieldCheck, text: "Every action is recorded in the audit log" },
];

export default async function AdminLoginPage() {
  const ctx = await getAdminContext();
  if (ctx) redirect("/admin");

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-between px-4 py-6"
      style={{
        background:
          "radial-gradient(ellipse at 12% 8%, rgba(229,168,35,.16), transparent 34%), radial-gradient(ellipse at 90% 95%, rgba(59,130,196,.18), transparent 38%), linear-gradient(145deg, #0b1426 0%, #16264a 60%, #1f4466 100%)",
      }}
    >
      <div className="flex w-full flex-1 items-center justify-center">
        <div
          className="grid w-full max-w-[52rem] overflow-hidden rounded-2xl border md:grid-cols-[0.9fr_1.1fr]"
          style={{ borderColor: "rgba(255,255,255,.14)", boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}
        >
          <section
            className="relative hidden flex-col justify-between gap-6 overflow-hidden p-7 text-white md:flex"
            style={{ background: "linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.01))" }}
          >
            <div className="absolute -right-16 -top-14 h-48 w-48 rounded-full border" style={{ borderColor: "rgba(229,168,35,.2)" }} aria-hidden />
            <div className="relative">
              <SjaaLogo className="mb-4 h-16 w-16 object-contain drop-shadow-lg" priority />
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "#f0c75e" }}>
                Administration workspace
              </p>
              <h1 className="text-lg font-extrabold leading-snug tracking-tight">{SCHOOL.name}</h1>
              <ul className="mt-5 space-y-2.5">
                {HIGHLIGHTS.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(229,168,35,.16)", color: "#f0c75e" }}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative border-t pt-4 text-[11px] leading-relaxed text-slate-300" style={{ borderColor: "rgba(255,255,255,.14)" }}>
              <p className="font-semibold text-white">{SCHOOL.motto}</p>
              <p className="mt-0.5">{SCHOOL.address}</p>
            </div>
          </section>

          <section className="relative flex items-center px-6 py-7 sm:px-8" style={{ background: "var(--card)", color: "var(--ink)" }}>
            <div className="w-full">
              <DeviceTheme />
              <div className="mb-5 text-center md:hidden">
                <SjaaLogo className="mx-auto mb-2 h-14 w-14 object-contain" />
                <p className="text-[13px] font-bold">{SCHOOL.name}</p>
              </div>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                  <ShieldCheck className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight">Administrator sign in</h2>
                  <p className="text-muted text-xs">Welcome back. Enter your account details.</p>
                </div>
              </div>
              <LoginForm />
              <p className="text-muted mt-5 border-t pt-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--line)" }}>
                Authorized personnel only. Sign-in activity is rate-limited and recorded.
              </p>
            </div>
          </section>
        </div>
      </div>
      <footer className="no-print mt-5 text-center text-[11px] text-slate-300/80">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>{SCHOOL.name}</span>
          <span className="opacity-40" aria-hidden>|</span>
          <span>{SCHOOL.address}</span>
          <span className="opacity-40" aria-hidden>|</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
