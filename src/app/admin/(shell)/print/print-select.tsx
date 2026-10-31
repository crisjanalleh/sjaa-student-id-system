"use client";

import { CheckSquare2, Loader2, Printer, Square, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const MAX_BATCH_SIZE = 100;

type Row = {
  id: number;
  code: string;
  studentIdNumber: string;
  name: string;
  gradeLevel: string;
  approvedAt: string | null;
};

export default function PrintSelect({
  applications,
  csrfToken,
}: {
  applications: Row[];
  csrfToken: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  const selectableApplications = applications.slice(0, MAX_BATCH_SIZE);
  const allSelected =
    selectableApplications.length > 0 &&
    selectableApplications.every((application) => selected.has(application.id));
  const selectedRows = useMemo(
    () => applications.filter((a) => selected.has(a.id)),
    [applications, selected],
  );

  const toggle = (id: number) => {
    if (!selected.has(id) && selected.size >= MAX_BATCH_SIZE) {
      setError(`A print batch can contain up to ${MAX_BATCH_SIZE} cards. Create a batch before selecting more.`);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setError("");
    setSelected((prev) =>
      allSelected ? new Set() : new Set(selectableApplications.map((a) => a.id)),
    );
  };

  async function createBatch() {
    if (busy || requestInFlight.current) return;
    if (selected.size === 0 || selected.size > MAX_BATCH_SIZE) {
      setError(`Select between 1 and ${MAX_BATCH_SIZE} approved applications.`);
      return;
    }
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; batchId?: number; error?: string }
        | null;
      if ((res.status === 201 || res.ok) && data?.ok && data.batchId) {
        router.push(`/admin/print/${data.batchId}`);
        router.refresh();
        return;
      }
      setError(data?.error || "Batch creation failed. Refresh and try again.");
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError("Connection was interrupted. Refresh the batch list before retrying; some selected records may already have been processed.");
      setConfirmOpen(false);
      router.refresh();
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
              <Printer className="h-3.5 w-3.5" aria-hidden />
            </span>
            Eligible Records — Approved
          </h2>
          <p className="text-muted mt-1 text-xs">
            {applications.length} approved application{applications.length === 1 ? "" : "s"} available ·{" "}
            {selected.size} of {MAX_BATCH_SIZE} selected
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={toggleAll} disabled={applications.length === 0 || busy}>
            {allSelected ? <Square className="h-4 w-4" aria-hidden /> : <CheckSquare2 className="h-4 w-4" aria-hidden />}
            {allSelected ? "Clear selection" : `Select first ${Math.min(MAX_BATCH_SIZE, applications.length)}`}
          </button>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            disabled={selected.size === 0 || busy}
            onClick={() => setConfirmOpen(true)}
          >
            <Printer className="h-4 w-4" aria-hidden /> Print batch ({selected.size})
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-xs text-[var(--ink)]"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--line)] text-muted">
            <Printer className="h-7 w-7" aria-hidden />
          </div>
          <p className="font-bold text-base text-[var(--ink)]">Nothing waiting to print</p>
          <p className="text-muted mt-1 text-xs max-w-sm mx-auto">
            No approved applications are queued for printing. Approve applications from the review queue first.
          </p>
        </div>
      ) : (
        <div className="max-h-[52vh] overflow-y-auto overflow-x-auto">
          <table className="tbl">
            <thead className="sticky top-0" style={{ background: "var(--elevated)" }}>
              <tr>
                <th className="w-10">
                  <span className="sr-only">Select</span>
                </th>
                <th>Control No.</th>
                <th>Student ID / LRN</th>
                <th>Student Name</th>
                <th>Grade</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      disabled={!selected.has(a.id) && selected.size >= MAX_BATCH_SIZE}
                      aria-label={`Select ${a.name} (${a.code})`}
                    />
                  </td>
                  <td className="font-mono text-xs font-bold">{a.code}</td>
                  <td className="font-mono text-xs">{a.studentIdNumber}</td>
                  <td className="max-w-[240px] truncate">{a.name}</td>
                  <td className="whitespace-nowrap">{a.gradeLevel}</td>
                  <td className="text-muted whitespace-nowrap text-xs">
                    {a.approvedAt ? new Date(a.approvedAt).toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch summary confirmation */}
      {confirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm batch print">
          <div className="modal-panel p-5">
            <h3 className="mb-2 text-sm font-bold">Confirm Batch Print</h3>
            <p className="text-muted mb-3 text-xs leading-relaxed">
              You are about to print <strong>{selected.size}</strong> ID card
              {selected.size === 1 ? "" : "s"}. This will:
            </p>
            <ul className="mb-3 list-inside list-disc text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              <li>mark all selected records as <strong>Printed</strong></li>
              <li>record the batch with the current template version</li>
              <li>queue &ldquo;Ready for claiming&rdquo; email notifications</li>
            </ul>
            <div className="max-h-40 overflow-y-auto rounded-md border p-2" style={{ borderColor: "var(--line)" }}>
              {selectedRows.map((r) => (
                <div key={r.id} className="flex justify-between gap-2 py-1 text-xs">
                  <span className="font-mono font-semibold">{r.code}</span>
                  <span className="text-muted truncate">{r.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-gold" onClick={createBatch} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
                Confirm &amp; Print
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
