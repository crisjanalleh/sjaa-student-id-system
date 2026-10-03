"use client";

import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  IdCard,
  ImageUp,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

type Props = {
  id: number;
  status: string;
  csrfToken: string;
  hasPhoto: boolean;
};

export default function ApplicationActions({ id, status, csrfToken, hasPhoto }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);

  async function post(url: string, body: Record<string, unknown>, busyKey: string) {
    if (requestInFlight.current) return false;
    requestInFlight.current = true;
    setBusy(busyKey);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        router.refresh();
        return true;
      }
      setError(data?.error || "Action failed. Please try again.");
      return false;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  const approve = () =>
    post(`/api/admin/applications/${id}/transition`, { action: "approve" }, "approve");

  const reject = async () => {
    const ok = await post(
      `/api/admin/applications/${id}/transition`,
      { action: "reject", reason },
      "reject",
    );
    if (ok) {
      setRejectOpen(false);
      setReason("");
    }
  };

  const claim = () =>
    post(`/api/admin/applications/${id}/transition`, { action: "claim" }, "claim");

  const doDelete = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy("delete");
    setError("");
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        router.push("/admin/applications");
        router.refresh();
        return;
      }
      setError(data?.error || "Delete failed.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  };

  const replacePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || requestInFlight.current) return;
    setError("");
    setWarning("");
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Only JPG or PNG images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be 5 MB or smaller.");
      return;
    }
    const fd = new FormData();
    fd.set("photo", file, file.name);
    requestInFlight.current = true;
    setBusy("replace");
    try {
      const res = await fetch(`/api/admin/applications/${id}/photo`, {
        method: "PUT",
        headers: { "x-csrf-token": csrfToken },
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; warning?: string | null } | null;
      if (res.ok && data?.ok) {
        setWarning(data.warning || "");
        router.refresh();
      } else {
        setError(data?.error || "Replacement failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  };

  return (
    <section className="card mt-5 p-4">
      <h2 className="lbl !mb-3">Actions</h2>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--danger)" }} role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {warning && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{warning}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "claimed" && (
          <span className="text-muted inline-flex items-center gap-1.5 text-xs" role="status">
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} aria-hidden />
            No action needed — the student ID has been collected.
          </span>
        )}
        {status === "pending" && (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={approve} disabled={Boolean(busy)}>
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BadgeCheck className="h-4 w-4" aria-hidden />}
              Approve
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setRejectOpen(true)} disabled={Boolean(busy)}>
              <Ban className="h-4 w-4" aria-hidden /> Reject
            </button>
          </>
        )}

        {status === "rejected" && (
          <button type="button" className="btn btn-gold btn-sm" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            {busy === "replace" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImageUp className="h-4 w-4" aria-hidden />}
            Replace Photo (Office Upload)
          </button>
        )}

        {status === "printed" && (
          <button type="button" className="btn btn-primary btn-sm" onClick={claim} disabled={Boolean(busy)}>
            {busy === "claim" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <IdCard className="h-4 w-4" aria-hidden />}
            Mark Claimed
          </button>
        )}

        {status !== "claimed" && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDeleteOpen(true)} disabled={Boolean(busy)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </button>
        )}

        {status === "approved" && (
          <span className="text-muted inline-flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} aria-hidden />
            Eligible for batch printing
          </span>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={replacePhoto}
        aria-label="Upload replacement photo"
      />
      {status === "rejected" && (
        <p className="text-muted mt-3 text-xs leading-relaxed">
          The student has been asked to bring a replacement photo to the office. Upload it
          here to return the application to <strong>Pending</strong> for re-review.
          {!hasPhoto && " (No photo is currently on file.)"}
        </p>
      )}

      {/* Reject dialog */}
      {rejectOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Reject application">
          <div className="modal-panel p-5">
            <h3 className="mb-2 text-sm font-bold">Reject Application</h3>
            <p className="text-muted mb-3 text-xs leading-relaxed">
              A rejection reason is required. The student will be emailed this reason and
              instructed to bring a replacement photo to the Administration Office.
            </p>
            <label className="lbl" htmlFor="reject_reason">
              Rejection Reason
            </label>
            <textarea
              id="reject_reason"
              className="inp"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Photo is blurry and the background is not plain."
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setRejectOpen(false)} disabled={busy === "reject"}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={reject} disabled={busy === "reject" || reason.trim().length < 4}>
                {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete application">
          <div className="modal-panel p-5">
            <h3 className="mb-2 text-sm font-bold">Delete Application</h3>
            <p className="text-muted text-xs leading-relaxed">
              This performs a soft delete: the record is hidden from all queues while its
              audit history is preserved. Claimed records cannot be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={doDelete} disabled={busy === "delete"}>
                {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
