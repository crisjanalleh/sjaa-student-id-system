"use client";

import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";

export default function SetupForm() {
  const [values, setValues] = useState({
    secret: "",
    username: "",
    fullName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (values.password !== values.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        window.location.assign("/admin/login");
        return;
      }
      setError(data?.error || "Setup failed. Please verify the details and try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const input = (
    key: keyof typeof values,
    label: string,
    type = "text",
    autoComplete = "off",
    hint = "",
  ) => (
    <div className="mb-4">
      <label className="lbl" htmlFor={`setup_${key}`}>
        {label}
      </label>
      <input
        id={`setup_${key}`}
        type={type}
        className="inp"
        value={values[key]}
        onChange={set(key)}
        autoComplete={autoComplete}
        maxLength={key === "password" || key === "confirm" ? 128 : 255}
      />
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--success)" }} aria-hidden />
        Create the Administrator Account
      </h2>
      <p className="text-muted mb-5 text-xs leading-relaxed">
        This one-time setup creates the first administrator and then permanently disables
        itself. There is no default password anywhere in this system.
      </p>
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
      {input("secret", "Setup Secret (from server environment)", "password", "off")}
      {input("username", "Username", "text", "username", "3–64 characters: letters, numbers, dot, dash, underscore.")}
      {input("fullName", "Full Name")}
      {input("email", "Email Address", "email", "email")}
      {input("password", "Password", "password", "new-password", "Minimum 12 characters. Use a password manager.")}
      {input("confirm", "Confirm Password", "password", "new-password")}
      <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Initializing…
          </>
        ) : (
          "Initialize System"
        )}
      </button>
    </form>
  );
}
