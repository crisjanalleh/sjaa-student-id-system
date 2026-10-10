"use client";

import { Crosshair, Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

type Notice = { kind: "ok" | "error"; text: string } | null;

export default function LocationEditor({ address, csrfToken }: { address: string; csrfToken: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [value, setValue] = useState(address);
  const [saved, setSaved] = useState(address);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, saving]);

  const trimmed = value.replace(/\s+/g, " ").trim();
  const dirty = trimmed !== saved;
  const valid = trimmed.length >= 8 && trimmed.length <= 200;

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; address?: string };
    if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }

  function detect() {
    setNotice(null);
    if (!navigator.geolocation) {
      setNotice({ kind: "error", text: "This browser cannot share your position. Please type the address." });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const data = await postJson("/api/admin/reverse-geocode", { lat: coords.latitude, lon: coords.longitude });
          setValue(data.address ?? "");
          setNotice({ kind: "ok", text: "Address filled in from your position. Please review it, then save." });
        } catch (err) {
          setNotice({ kind: "error", text: err instanceof Error ? err.message : "Could not look up the address." });
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setNotice({
          kind: "error",
          text: err.code === err.PERMISSION_DENIED
            ? "Location access was blocked. Allow it in your browser, or type the address."
            : "Your position could not be determined. Please type the address.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function save() {
    setSaving(true);
    try {
      const data = await postJson("/api/admin/school-location", { address: trimmed });
      setSaved(data.address ?? trimmed);
      setValue(data.address ?? trimmed);
      setConfirming(false);
      setNotice({ kind: "ok", text: "School location updated everywhere." });
      router.refresh();
    } catch (err) {
      setConfirming(false);
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Could not save the location." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label htmlFor={fieldId} className="admin-workspace-section-title">School address</label>
      <textarea
        id={fieldId}
        className="input"
        rows={3}
        maxLength={200}
        value={value}
        onChange={(e) => { setValue(e.target.value); setNotice(null); }}
        style={{ resize: "vertical", fontSize: 12 }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={detect} disabled={locating}>
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Crosshair className="h-3.5 w-3.5" aria-hidden />}
          {locating ? "Locating…" : "Use my current location"}
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || !valid} onClick={() => setConfirming(true)}>
          Save location
        </button>
      </div>
      <p className="text-muted mt-1.5 text-[10px] leading-snug">
        Shown on the login page, the header and this panel. Using your current location sends your coordinates to OpenStreetMap to find the address.
      </p>
      {notice && (
        <p className="mt-1.5 text-[11px] font-semibold" role={notice.kind === "error" ? "alert" : "status"} style={{ color: notice.kind === "error" ? "var(--danger)" : "var(--success, #15803d)" }}>
          {notice.text}
        </p>
      )}
      {confirming && createPortal(
        <div className="confirm-backdrop" onMouseDown={() => !saving && setConfirming(false)}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-t`} onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 shrink-0" style={{ color: "var(--gold)" }} aria-hidden />
              <h2 id={`${fieldId}-t`} className="text-base font-extrabold">Confirm school location</h2>
            </div>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              You are about to change the school location. It will appear on the administrator login page, the page header and the workspace panel for everyone.
            </p>
            <p className="confirm-address">{trimmed}</p>
            <p className="mt-2 text-sm font-semibold">Please make sure this address is correct before continuing.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={saving}>Review again</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving} autoFocus>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {saving ? "Saving…" : "Yes, save location"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
