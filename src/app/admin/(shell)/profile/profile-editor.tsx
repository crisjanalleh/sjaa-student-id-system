"use client";

import {
  Camera,
  CheckCircle2,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Trash2,
  TriangleAlert,
  Undo2,
  User,
  UserCheck,
} from "lucide-react";
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
  const [profile, setProfile] = useState<Profile>(initial);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);

  const isDirty =
    profile.fullName !== initial.fullName ||
    profile.username !== initial.username ||
    profile.email !== initial.email ||
    profile.avatarDataUrl !== initial.avatarDataUrl ||
    currentPassword.trim() !== "" ||
    newPassword.trim() !== "" ||
    confirmPassword.trim() !== "";

  function resetForm() {
    setProfile(initial);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Please choose a valid JPG or PNG profile image.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Profile image must be 1 MB or smaller.");
      return;
    }
    try {
      const avatarDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("File could not be read."));
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
    if (!isDirty || busy || requestInFlight.current) return;
    if (!currentPassword) {
      setError("Enter your current administrator password to authorize profile changes.");
      return;
    }
    if (newPassword && newPassword.length < 12) {
      setError("New password must be at least 12 characters long.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("The new password and confirmation password do not match.");
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
        | {
            ok?: boolean;
            error?: string;
            fullName?: string;
            username?: string;
            email?: string;
            passwordChanged?: boolean;
          }
        | null;

      if (!response.ok || !data?.ok) {
        setError(data?.error || "Your profile could not be saved. Please check your credentials.");
        return;
      }

      if (data.fullName && data.username && data.email) {
        setProfile((value) => ({
          ...value,
          fullName: data.fullName!,
          username: data.username!,
          email: data.email!,
        }));
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(
        data.passwordChanged
          ? "Profile and password updated successfully! Other active sessions were signed out."
          : "Profile details updated successfully."
      );
      router.refresh();
    } catch {
      setError("Connection issue while saving profile. Please check your network and try again.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={save}>
      {/* Status Notifications */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
          <div className="flex-1">
            <p className="font-bold">Unable to save profile</p>
            <p className="mt-0.5 text-xs opacity-90">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div
          className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div className="flex-1">
            <p className="font-bold">Changes saved</p>
            <p className="mt-0.5 text-xs opacity-90">{success}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Overview & Identity Card */}
      <div className="card overflow-hidden border border-[var(--line)] bg-[var(--elevated)] shadow-sm">
        {/* Subtle decorative banner */}
        <div className="h-20 bg-gradient-to-r from-[var(--academic-blue)]/25 via-[var(--accent-fill)]/15 to-transparent border-b border-[var(--line)]/60 relative" />

        <div className="px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 -mt-10 mb-6">
            {/* Avatar with Interactive Click & Camera Trigger */}
            <div className="relative group shrink-0">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={choosePhoto}
              />
              <div
                onClick={() => fileRef.current?.click()}
                className="h-24 w-24 rounded-full overflow-hidden border-4 border-[var(--elevated)] bg-[var(--card)] shadow-md flex items-center justify-center text-3xl font-extrabold text-[var(--academic-blue)] ring-1 ring-[var(--line-strong)] cursor-pointer"
                title="Click to change profile photo"
              >
                {profile.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarDataUrl}
                    alt={profile.fullName || "Administrator"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  profile.fullName.trim().charAt(0).toUpperCase() || "A"
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 backdrop-blur-xs cursor-pointer"
                title="Change photo"
                aria-label="Change photo"
              >
                <Camera className="h-6 w-6 mb-0.5" aria-hidden />
                <span className="text-[10px] font-bold tracking-wider uppercase">Change</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="sm:hidden absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[var(--academic-blue)] text-white flex items-center justify-center shadow-md ring-2 ring-[var(--elevated)] cursor-pointer"
                title="Change photo"
                aria-label="Change photo"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            {/* Profile Summary & Actions */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] truncate">
                  {profile.fullName || "System Administrator"}
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--academic-blue)]/12 px-2.5 py-0.5 text-xs font-semibold text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20">
                  <Shield className="h-3 w-3" aria-hidden />
                  Administrator
                </span>
              </div>
              <p className="text-muted text-xs flex items-center gap-3 mt-1 truncate">
                <span className="font-mono">@{profile.username || "admin"}</span>
                <span>•</span>
                <span>{profile.email || "No email assigned"}</span>
              </p>
            </div>

            {/* Action Buttons: only show Remove when a photo exists */}
            {profile.avatarDataUrl && (
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end pt-2 sm:pt-0">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  onClick={() => setProfile((value) => ({ ...value, avatarDataUrl: null }))}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove photo
                </button>
              </div>
            )}
          </div>

          <p className="text-muted text-xs border-t border-[var(--line)] pt-3 leading-relaxed">
            Click your profile photo to upload a new picture (PNG or JPG up to 1 MB). Your picture will appear on the sidebar and activity logs.
          </p>
        </div>
      </div>

      {/* Account & Personal Information Card */}
      <div className="card p-6 border border-[var(--line)] bg-[var(--elevated)] shadow-sm space-y-6">
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--academic-blue)]/10 text-[var(--academic-blue)] ring-1 ring-[var(--academic-blue)]/20">
              <UserCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)] tracking-tight">Account Information</h3>
              <p className="text-muted text-xs mt-0.5">
                Display name and communication channels linked to your administrator profile.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="lbl" htmlFor="profile_full_name">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Full Name</span>
            </label>
            <input
              id="profile_full_name"
              className="inp"
              type="text"
              autoComplete="name"
              maxLength={150}
              required
              value={profile.fullName}
              onChange={(e) => setProfile((value) => ({ ...value, fullName: e.target.value }))}
              placeholder="e.g. John Doe"
            />
            <p className="text-muted text-[11px] leading-snug">
              Displayed on ID approvals, reports, and administrative signatures.
            </p>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="lbl" htmlFor="profile_email">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Email Address</span>
            </label>
            <input
              id="profile_email"
              className="inp"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
              value={profile.email}
              onChange={(e) => setProfile((value) => ({ ...value, email: e.target.value }))}
              placeholder="admin@sjaa.edu.ph"
            />
            <p className="text-muted text-[11px] leading-snug">
              Receives critical security alerts, system backups, and application summaries.
            </p>
          </div>

          {/* Login Username with proper non-distorted prefix */}
          <div className="sm:col-span-2 space-y-1.5 pt-1">
            <label className="lbl" htmlFor="profile_username">
              <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Sign-In Username</span>
            </label>
            <div className="inp-prefix-wrap">
              <span className="inp-prefix-icon" aria-hidden>@</span>
              <input
                id="profile_username"
                className="inp inp-with-prefix font-mono"
                type="text"
                autoComplete="username"
                minLength={3}
                maxLength={64}
                required
                value={profile.username}
                onChange={(e) => setProfile((value) => ({ ...value, username: e.target.value }))}
                placeholder="username"
              />
            </div>
            <p className="text-muted text-[11px] leading-snug">
              The username you use when logging into the San Jose Adventist Academy administration portal.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Password Card */}
      <div className="card p-6 border border-[var(--line)] bg-[var(--elevated)] shadow-sm space-y-6">
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)] tracking-tight">Security & Credentials</h3>
              <p className="text-muted text-xs mt-0.5">
                Update your login password and authorize your changes with your current credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Informational Callout */}
        <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--field-bg)]/60 p-4 text-xs text-muted leading-relaxed">
          <Info className="h-4 w-4 shrink-0 text-[var(--academic-blue)] mt-0.5" aria-hidden />
          <div>
            <strong className="text-[var(--ink)]">Password Security Policy:</strong> To keep this portal secure,
            entering your <span className="underline decoration-dotted">Current Password</span> is mandatory before any changes can be saved. Leave the new password fields blank if you only want to change your profile name, email, or photo.
          </div>
        </div>

        <div className="space-y-5">
          {/* Current Password Field */}
          <div className="space-y-1.5 p-4 rounded-xl border border-[var(--line-strong)]/60 bg-[var(--card)]/50">
            <label className="lbl justify-between" htmlFor="profile_current_password">
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Current Password</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-600 dark:text-rose-400">
                (Required to authorize changes)
              </span>
            </label>
            <input
              id="profile_current_password"
              className="inp"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <p className="text-muted text-[11px] leading-snug">
              Required for security authorization whenever updating account details or passwords.
            </p>
          </div>

          {/* New Password & Confirm */}
          <div className="grid gap-5 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5">
              <label className="lbl" htmlFor="profile_new_password">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>New Password</span>
                <span className="text-[10px] lowercase text-muted font-normal">(optional)</span>
              </label>
              <input
                id="profile_new_password"
                className="inp"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 12 characters"
              />
              <p className="text-muted text-[11px] leading-snug">
                Leave blank to keep your current password. Minimum 12 characters.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="lbl" htmlFor="profile_confirm_password">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Confirm New Password</span>
              </label>
              <input
                id="profile_confirm_password"
                className="inp"
                type="password"
                autoComplete="new-password"
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
              <p className="text-muted text-[11px] leading-snug">
                Re-type your new password to verify accuracy before saving.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-[var(--line)] bg-[var(--elevated)] shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span>Security audit log will record profile modifications.</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {isDirty && (
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-1.5 text-xs"
              onClick={resetForm}
              disabled={busy}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
          )}

          <button
            type="submit"
            className="btn btn-primary px-6 py-2 gap-2 text-sm font-bold shadow-sm"
            disabled={busy || !isDirty}
            title={!isDirty ? "Make changes to enable saving" : "Save your changes"}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {busy ? "Saving changes…" : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
