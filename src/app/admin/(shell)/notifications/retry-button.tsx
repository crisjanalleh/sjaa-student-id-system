"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function RetryButton({
  id,
  csrfToken,
}: {
  id: number;
  csrfToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  async function retry() {
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/notifications/${id}/retry`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; delivered?: boolean }
        | null;
      if (!response.ok || !data?.ok || !data.delivered) {
        setError(data?.error || "Email delivery failed. Check the notification details and SMTP settings.");
      }
      router.refresh();
    } catch {
      setError("Connection problem while retrying this notification.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn btn-outline btn-sm" onClick={retry} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
        {busy ? "Retrying…" : "Retry"}
      </button>
      {error && <span className="max-w-56 text-right text-xs" style={{ color: "var(--danger)" }} role="alert">{error}</span>}
    </div>
  );
}
