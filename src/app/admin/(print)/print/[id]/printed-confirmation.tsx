"use client";

import { CheckCircle2, IdCard, Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function PrintedConfirmation({
  batchId,
  batchCode,
  cardCount,
  printedAt,
  csrfToken,
}: {
  batchId: number;
  batchCode: string;
  cardCount: number;
  printedAt: string | null;
  csrfToken: string;
}) {
  const router = useRouter();
  const [printDialogClosed, setPrintDialogClosed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allPrinted, setAllPrinted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notificationWarning, setNotificationWarning] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (printedAt) return;
    const onAfterPrint = () => setPrintDialogClosed(true);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [printedAt]);

  async function confirmPrinted() {
    if (!allPrinted || busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/batches/${batchId}/printed`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ confirmedPrinted: true }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; notificationAttention?: boolean }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Could not confirm printing. Refresh the page and try again.");
        return;
      }
      setNotificationWarning(Boolean(data.notificationAttention));
      setConfirmOpen(false);
      setAllPrinted(false);
      router.refresh();
    } catch {
      setError("Connection was interrupted. Refresh this page to check whether printing was recorded before retrying.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  if (printedAt) {
    return (
      <section className="no-print mx-auto mb-4 max-w-4xl rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--success)", background: "var(--card)" }} role="status">
        <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--success)" }}>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Batch confirmed printed and ready for collection.
        </p>
        <p className="text-muted mt-1 text-xs">
          The application statuses and ready-for-collection notifications have been recorded. The physical handover still must be confirmed separately when each student collects an ID.
        </p>
        {notificationWarning && (
          <p className="mt-2 flex items-start gap-2 text-xs" style={{ color: "var(--danger)" }}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            One or more email notifications need attention. Review them on the Notifications page.
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="no-print mx-auto mb-4 max-w-4xl rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        {printDialogClosed ? (
          <>
            <p className="font-semibold">Confirm the physical cards are printed</p>
            <p className="text-muted mt-1 text-xs">
              Creating a batch or opening the print dialog does not mark IDs as printed. Confirm only if every card in batch {batchCode} printed successfully and is ready for collection.
            </p>
            {error && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }} role="alert">{error}</p>}
            <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => setConfirmOpen(true)} disabled={busy}>
              <IdCard className="h-4 w-4" aria-hidden />
              Confirm {cardCount} printed {cardCount === 1 ? "ID" : "IDs"}
            </button>
          </>
        ) : (
          <p className="text-muted text-xs">
            Print this batch first. When the print dialog closes, you can confirm whether all cards printed successfully.
          </p>
        )}
      </section>
      {confirmOpen && (
        <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="Confirm completed ID printing">
          <div className="modal-panel p-5">
            <h2 className="mb-2 text-sm font-bold">Mark IDs Printed and Ready</h2>
            <p className="text-muted text-xs leading-relaxed">
              This updates {cardCount} application records to <strong>Printed</strong>, writes the audit event, and queues student collection emails. It does not mark IDs as claimed.
            </p>
            <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allPrinted}
                onChange={(event) => setAllPrinted(event.target.checked)}
              />
              <span>All {cardCount} cards in this batch printed successfully and are ready for collection.</span>
            </label>
            {error && <p className="mt-3 text-xs" style={{ color: "var(--danger)" }} role="alert">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirmPrinted} disabled={!allPrinted || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                Confirm Printed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
