"use client";

import { CheckCircle2, ImagePlus, Loader2, Save, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

type Profile = {
  fullName: string;
  username: string;
  email: string;
  avatarDataUrl: string | null;
};

export default function ProfileEditor({
  csrfToken,
  initial,
}: {
  csrfToken: string;
  initial: Profile;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState(initial);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Choose a JPG or PNG profile photo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Profile photo must be 1 MB or smaller.");
      return;
    }
    try {
      const avatarDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("File could not be read."));
        reader.onerror = () => reject(new Error("File could not be read."));
        reader.readAsDataURL(file);
      });
      setProfile((value) => ({ ...value, avatarDataUrl }));
      setError("");
      setSuccess("");
    } catch {
      setError("The selected photo could not be read. Please choose another file.");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || requestInFlight.current) return;
    if (!currentPassword) {
      setError("Enter your current password to confirm profile changes.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          ...profile,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; fullName?: string; username?: string; email?: string; passwordChanged?: boolean }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Your profile could not be saved. Please try again.");
        return;
      }
      if (data.fullName && data.username && data.email) {
        setProfile((value) => ({ ...value, fullName: data.fullName!, username: data.username!, email: data.email! }));
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(data.passwordChanged
        ? "Profile saved. Other administrator sessions were signed out."
        : "Profile changes saved.");
      router.refresh();
    } catch {
      setError("Connection problem while saving your profile. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="card p-5 sm:p-6" onSubmit={save}>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: "var(--danger)" }} role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }} role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {success}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-4 text-sm font-bold">Profile details</h2>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-slate-100 text-2xl font-bold text-slate-500" style={{ borderColor: "var(--line-strong)" }}>
            {profile.avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarDataUrl} alt="Administrator profile" className="h-full w-full object-cover" />
            ) : profile.fullName.trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={choosePhoto} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" aria-hidden /> Change photo
            </button>
            {profile.avatarDataUrl && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProfile((value) => ({ ...value, avatarDataUrl: null }))}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </button>
            )}
            <p className="text-muted w-full text-xs">JPG or PNG · maximum 1 MB. The image is resized before storage.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="lbl" htmlFor="profile_full_name">Full name</label>
            <input id="profile_full_name" className="inp" autoComplete="name" maxLength={150} required value={profile.fullName} onChange={(e) => setProfile((value) => ({ ...value, fullName: e.target.value }))} />
          </div>
          <div>
            <label className="lbl" htmlFor="profile_username">Login username</label>
            <input id="profile_username" className="inp" autoComplete="username" minLength={3} maxLength={64} required value={profile.username} onChange={(e) => setProfile((value) => ({ ...value, username: e.target.value }))} />
            <p className="text-muted mt-1 text-xs">This is the username you enter on the administrator sign-in page.</p>
          </div>
          <div>
            <label className="lbl" htmlFor="profile_email">Email address</label>
            <input id="profile_email" className="inp" type="email" autoComplete="email" maxLength={255} required value={profile.email} onChange={(e) => setProfile((value) => ({ ...value, email: e.target.value }))} />
          </div>
        </div>
      </section>

      <section className="mb-6 border-t pt-5" style={{ borderColor: "var(--line)" }}>
        <h2 className="mb-1 text-sm font-bold">Change password</h2>
        <p className="text-muted mb-4 text-xs">Leave the new password fields blank to keep your current password. A new password must have at least 12 characters.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="lbl" htmlFor="profile_current_password">Current password <span className="normal-case">(required to save)</span></label>
            <input id="profile_current_password" className="inp" type="password" autoComplete="current-password" maxLength={128} required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="lbl" htmlFor="profile_new_password">New password</label>
            <input id="profile_new_password" className="inp" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="lbl" htmlFor="profile_confirm_password">Confirm new password</label>
            <input id="profile_confirm_password" className="inp" type="password" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--line)" }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
