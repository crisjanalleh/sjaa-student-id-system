"use client";

import { Printer, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PrintSummary } from "@/lib/print-progress-types";
import {
  onPrintChanged,
  PrintDetailTable,
  ProgressBar,
  StatusPill,
  usePrintDetail,
} from "@/components/print-progress/print-progress-ui";

export function DetailModal({ batchId, onClose }: { batchId: number; onClose: () => void }) {
  const { detail, error } = usePrintDetail(batchId, null);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Batch print progress" onClick={onClose}>
      <div className="modal-panel p-5" style={{ maxWidth: 720, width: "100%" }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">
              Print progress {detail && <span className="font-mono">· {detail.batchCode}</span>}
            </h2>
            {detail && (
              <p className="text-muted mt-0.5 text-xs">
                {detail.printed} printed · {detail.printing} printing now · {detail.queued} queued
              </p>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Minimize print progress">
            <X className="h-4 w-4" aria-hidden /> Minimize
          </button>
        </div>
        {!detail ? (
          <p className="text-muted text-xs">{error || "Loading…"}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar printed={detail.printed} printing={detail.printing} total={detail.total} label="Print progress" />
              </div>
              <span className="text-xs font-bold">{detail.percent}%</span>
              <StatusPill status={detail.status} />
            </div>
            <PrintDetailTable detail={detail} />
            <div className="mt-3 text-right">
              <Link href={`/admin/print/${detail.batchId}`} className="btn btn-outline btn-sm">
                Open print window
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Floating bar shown on every admin page while any batch has cards printing. */
export default function PrintProgressDock() {
  const [active, setActive] = useState<PrintSummary[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/print-progress", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as { ok?: boolean; active?: PrintSummary[] } | null;
        if (!cancelled && response.ok && data?.ok && data.active) setActive(data.active);
      } catch {
        // Keep the last known state; the next poll will retry.
      }
    };
    const loop = async () => {
      if (!document.hidden) await load();
      if (!cancelled) timer = window.setTimeout(loop, 5000);
    };
    void loop();
    const stop = onPrintChanged(() => void load());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, []);

  const current = active[0];
  return (
    <>
      {current && (
        <button
          type="button"
          className="print-pill no-print"
          onClick={() => setOpenId(current.batchId)}
          aria-label={`Batch ${current.batchCode} printing, ${current.percent} percent. Open details.`}
        >
          <span className="flex items-center justify-between gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5">
              <Printer className="h-4 w-4" aria-hidden /> Printing {current.batchCode}
              {active.length > 1 && <span className="text-muted font-normal">+{active.length - 1} more</span>}
            </span>
            <span>{current.percent}%</span>
          </span>
          <ProgressBar printed={current.printed} printing={current.printing} total={current.total} label="Print progress" />
          <span className="text-muted text-[11px]">
            {current.printed} printed · {current.printing} printing · {current.queued} queued — click for details
          </span>
        </button>
      )}
      {openId !== null && <DetailModal batchId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
