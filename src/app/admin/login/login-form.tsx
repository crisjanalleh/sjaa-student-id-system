"use client";

import { Loader2, LockKeyhole, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      <h2 className="mb-5 flex items-center gap-2 text-base font-bold">
        <LockKeyhole className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
        Administrator Sign In
      </h2>

      {error && (
        <div
          className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--danger)" }}
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
        <input
          id="login_username"
          className="inp"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          maxLength={64}
        />
      </div>
      <div className="mb-5">
        <label className="lbl" htmlFor="login_password">
          Password
        </label>
        <input
          id="login_password"
          type="password"
          className="inp"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={128}
        />
      </div>
      <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying…
          </>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
