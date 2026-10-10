"use client";

import { Loader2, PenLine, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BLOOD_TYPES, GRADE_LEVELS, TRACK_STRANDS } from "@/lib/fields";

type Initial = Record<string, string>;

export default function EditDetailsForm({
  id,
  csrfToken,
  initial,
}: {
  id: number;
  csrfToken: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Initial>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const isShs = values.gradeLevel === "Grade 11" || values.gradeLevel === "Grade 12";
  const set = (k: string) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((current) => {
      if (k === "gradeLevel" && value !== "Grade 11" && value !== "Grade 12") {
        return { ...current, gradeLevel: value, trackStrand: "" };
      }
      return { ...current, [k]: value };
    });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setServerError("");
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; errors?: Record<string, string> }
        | null;
      if (res.ok && data?.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      if (data?.errors) setErrors(data.errors);
      setServerError(data?.error || "Save failed.");
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <section className="card p-4">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
          <PenLine className="h-4 w-4" aria-hidden /> Edit Details
        </button>
      </section>
    );
  }

  const textField = (key: string, label: string, span = false) => (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="lbl" htmlFor={`edit_${key}`}>
        {label}
      </label>
      {key === "address" ? (
        <textarea id={`edit_${key}`} className="inp" rows={2} value={values[key] || ""} onChange={set(key)} />
      ) : (
        <input id={`edit_${key}`} className="inp" value={values[key] || ""} onChange={set(key)} maxLength={key === "address" ? 500 : 150} />
      )}
      {errors[key] && <p className="field-error" role="alert">{errors[key]}</p>}
    </div>
  );

  return (
    <section className="card p-4">
      <form onSubmit={onSubmit} noValidate>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <PenLine className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Edit Details
        </h2>
        {serverError && (
          <div className="mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--danger)" }} role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
            <span>{serverError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {textField("studentIdNumber", "Student ID / LRN")}
          <div>
            <label className="lbl" htmlFor="edit_gradeLevel">Grade Level</label>
            <select id="edit_gradeLevel" className="inp" value={values.gradeLevel} onChange={set("gradeLevel")}>
              <option value="">Select…</option>
              {values.gradeLevel && !(GRADE_LEVELS as readonly string[]).includes(values.gradeLevel) && (
                <option value={values.gradeLevel}>Existing record: {values.gradeLevel} (select a current grade)</option>
              )}
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {errors.gradeLevel && <p className="field-error" role="alert">{errors.gradeLevel}</p>}
          </div>
          {textField("firstName", "First Name")}
          {textField("middleName", "Middle Name (optional)")}
          {textField("lastName", "Last Name")}
          {textField("suffix", "Suffix (optional)")}
          <div>
            <label className="lbl" htmlFor="edit_trackStrand">Track / Strand</label>
            <select id="edit_trackStrand" className="inp" value={isShs && (TRACK_STRANDS as readonly string[]).includes(values.trackStrand || "") ? values.trackStrand : ""} onChange={set("trackStrand")} disabled={!isShs}>
              <option value="">{isShs ? "Select STEM or HUMSS…" : "Only applies to Grades 11–12"}</option>
              {TRACK_STRANDS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {isShs && values.trackStrand && !(TRACK_STRANDS as readonly string[]).includes(values.trackStrand) && (
              <p className="text-muted mt-1 text-xs">Stored value “{values.trackStrand}” is no longer offered. Select STEM or HUMSS.</p>
            )}
            {errors.trackStrand && <p className="field-error" role="alert">{errors.trackStrand}</p>}
          </div>
          <div>
            <label className="lbl" htmlFor="edit_bloodType">Blood Type</label>
            <select id="edit_bloodType" className="inp" value={values.bloodType || ""} onChange={set("bloodType")}>
              <option value="">Unknown</option>
              {BLOOD_TYPES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.bloodType && <p className="field-error" role="alert">{errors.bloodType}</p>}
          </div>
          {textField("address", "Address", true)}
          {textField("email", "Email (optional)")}
          {textField("contactNumber", "Contact Number (optional)")}
          {textField("emergencyContactName", "Emergency Contact Person")}
          {textField("emergencyContactPhone", "Emergency Contact Phone")}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setValues(initial); setErrors({}); setServerError(""); }} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PenLine className="h-4 w-4" aria-hidden />}
            Save Changes
          </button>
        </div>
      </form>
    </section>
  );
}
