import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { SCHOOL } from "@/lib/config";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administrator Sign In" };

export default async function AdminLoginPage() {
  const ctx = await getAdminContext();
  if (ctx) redirect("/admin");

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        background: "radial-gradient(ellipse at 15% 10%, rgba(229,168,35,.22), transparent 32%), linear-gradient(145deg, #0b1426 0%, #1b2a4a 58%, #254e70 100%)",
      }}
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl md:grid-cols-[1.05fr_0.95fr]" style={{ borderColor: "rgba(255,255,255,.16)", boxShadow: "0 28px 80px rgba(0,0,0,.32)" }}>
        <section className="relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex" style={{ background: "linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.015))" }}>
          <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full border" style={{ borderColor: "rgba(229,168,35,.22)" }} aria-hidden />
          <div className="absolute -right-8 -top-4 h-40 w-40 rounded-full border" style={{ borderColor: "rgba(229,168,35,.2)" }} aria-hidden />
          <div className="relative">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl text-base font-extrabold shadow-lg" style={{ background: "var(--accent-gold)", color: "var(--primary-navy)" }} aria-hidden>
              SJ
            </div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#f0c75e" }}>Administration workspace</p>
            <h1 className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight">{SCHOOL.name}</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
              Manage student applications, prepare ID batches, and keep issuance records in one secure workspace.
            </p>
          </div>
          <div className="relative border-t pt-5 text-xs leading-relaxed text-slate-300" style={{ borderColor: "rgba(255,255,255,.15)" }}>
            <p className="font-semibold text-white">{SCHOOL.motto}</p>
            <p className="mt-1">{SCHOOL.location} · Est. {SCHOOL.established}</p>
          </div>
        </section>
        <section className="flex items-center bg-white px-6 py-9 sm:px-10">
          <div className="w-full">
            <div className="mb-7 md:hidden">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-extrabold" style={{ background: "var(--accent-gold)", color: "var(--primary-navy)" }} aria-hidden>SJ</div>
              <p className="text-muted text-xs font-semibold uppercase tracking-wider">Administration workspace</p>
            </div>
            <div className="mb-6">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Welcome back</h2>
              <p className="text-muted mt-1 text-sm">Sign in with your administrator account to continue.</p>
            </div>
            <LoginForm />
            <div className="text-muted mt-6 border-t pt-4 text-[11px] leading-relaxed" style={{ borderColor: "#e2e8f0" }}>
              Authorized personnel only. Sign-in activity is rate-limited and recorded in the audit log.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
