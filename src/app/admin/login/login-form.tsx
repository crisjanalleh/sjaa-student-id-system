"use client";

import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, TriangleAlert, User } from "lucide-react";
import { useState, type FormEvent } from "react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; redirect: string }
        | { ok: false; error: string }
        | null;

      if (res.ok && data && "ok" in data && data.ok) {
        window.location.assign("redirect" in data ? data.redirect : "/admin");
        return;
      }
      setError(data && "error" in data ? data.error : "Sign-in failed. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 8%, transparent)" }}
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4">
        <label className="lbl" htmlFor="login_username">
          Username
        </label>
        <div className="relative">
          <User className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
          <input
            id="login_username"
            className="inp !pl-10"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            maxLength={64}
            placeholder="Enter your username"
          />
        </div>
      </div>
      <div className="mb-6">
        <label className="lbl" htmlFor="login_password">
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
          <input
            id="login_password"
            type={showPassword ? "text" : "password"}
            className="inp !pl-10 !pr-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            maxLength={128}
            placeholder="Enter your password"
          />
          <button
            type="button"
            className="text-muted absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:text-[var(--ink)]"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
      <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden /> Sign In
          </>
        )}
      </button>
    </form>
  );
}
