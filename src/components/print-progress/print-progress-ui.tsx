"use client";

import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PRINT_STATUS_LABEL,
  type PrintDetail,
  type PrintItemState,
  type PrintStatus,
} from "@/lib/print-progress-types";

const PING_KEY = "sjaa-print-progress-ping";

/** Tells other open tabs/windows (admin shell, print window) to refresh progress right away. */
export function notifyPrintChanged() {
  try {
    window.localStorage.setItem(PING_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode); polling still keeps things current.
  }
}

export function onPrintChanged(listener: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === PING_KEY) listener();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Loads one batch's progress and keeps it fresh: every 3 s while printing, 15 s otherwise. */
export function usePrintDetail(batchId: number, initial: PrintDetail | null, enabled = true) {
  const [detail, setDetail] = useState<PrintDetail | null>(initial);
  const [error, setError] = useState("");
  const statusRef = useRef<PrintStatus | null>(initial?.status ?? null);

  useEffect(() => {
    statusRef.current = detail?.status ?? null;
  }, [detail]);

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/print-progress?batchId=${batchId}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; detail?: PrintDetail } | null;
      if (!response.ok || !data?.ok || !data.detail) throw new Error("bad response");
      setDetail(data.detail);
      setError("");
    } catch {
      setError("Live progress is temporarily unavailable. It will keep retrying.");
    }
  }, [batchId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | undefined;
    const loop = async () => {
      if (!document.hidden) await reload();
      if (!cancelled) timer = window.setTimeout(loop, statusRef.current === "printing" ? 3000 : 15000);
    };
    void loop();
    const stop = onPrintChanged(() => void reload());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, [enabled, reload]);

  return { detail, setDetail, error, reload };
}

const STATUS_COLOR: Record<PrintStatus, string> = {
  "not-started": "var(--muted)",
  "in-progress": "var(--academic-blue)",
  printing: "var(--accent-gold)",
  ready: "var(--success)",
  completed: "var(--success)",
};

export function StatusPill({ status }: { status: PrintStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
      style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}
    >
      {status === "printing" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {(status === "ready" || status === "completed") && <CheckCircle2 className="h-3 w-3" aria-hidden />}
      {PRINT_STATUS_LABEL[status]}
    </span>
  );
}

export function ProgressBar({ printed, printing, total, label, thin }: { printed: number; printing: number; total: number; label: string; thin?: boolean }) {
  const donePct = total === 0 ? 0 : (printed / total) * 100;
  const livePct = total === 0 ? 0 : (printing / total) * 100;
  return (
    <div
      className={`${thin ? "h-1.5" : "h-2.5"} w-full overflow-hidden rounded-full`}
      style={{ background: "var(--line)" }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={printed}
    >
      <div className="flex h-full">
        <div className="h-full transition-[width] duration-500" style={{ width: `${donePct}%`, background: "var(--success)" }} />
        <div
          className="print-bar-live h-full transition-[width] duration-500"
          style={{ width: `${livePct}%`, backgroundColor: "var(--accent-gold)" }}
        />
      </div>
    </div>
  );
}

const FILTERS: { key: "all" | PrintItemState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "printing", label: "Printing" },
  { key: "queued", label: "Queued" },
  { key: "printed", label: "Printed" },
];
const PAGE = 100;

/** Record-by-record view: which card is printing now, what is queued, what is done. */
export function PrintDetailTable({ detail }: { detail: PrintDetail }) {
  const [filter, setFilter] = useState<"all" | PrintItemState>("all");
  const [limit, setLimit] = useState(PAGE);
  const counts = {
    all: detail.items.length,
    printing: detail.printing,
    queued: detail.queued,
    printed: detail.printed,
  };
  const rows = detail.items.filter((item) => filter === "all" || item.state === filter);
  const visible = rows.slice(0, limit);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter records by print status">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={filter === entry.key ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
            onClick={() => {
              setFilter(entry.key);
              setLimit(PAGE);
            }}
            aria-pressed={filter === entry.key}
          >
            {entry.label} <span className="opacity-80">({counts[entry.key]})</span>
          </button>
        ))}
      </div>
      <div className="table-scroll max-h-80 overflow-y-auto rounded-md border" style={{ borderColor: "var(--line)" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Control No.</th>
              <th>Student</th>
              <th>Set</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted py-6 text-center text-xs">
                  No records in this view.
                </td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr key={item.itemId} style={item.state === "printing" ? { background: "var(--bg)" } : undefined}>
                  <td className="text-muted text-xs">{detail.items.indexOf(item) + 1}</td>
                  <td className="font-mono text-xs font-bold">{item.code}</td>
                  <td className="text-xs">
                    {item.name}
                    <span className="text-muted block text-[10.5px]">{item.gradeLevel}</span>
                  </td>
                  <td className="text-xs">Set {item.setNo}</td>
                  <td className="text-xs font-semibold">
                    {item.state === "printed" && (
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--success)" }}>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Printed
                      </span>
                    )}
                    {item.state === "printing" && (
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--accent-gold)" }}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Printing now
                      </span>
                    )}
                    {item.state === "queued" && (
                      <span className="text-muted inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden /> Queued · #{item.queuePosition}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > visible.length && (
        <button type="button" className="btn btn-outline btn-sm mt-2" onClick={() => setLimit((value) => value + PAGE)}>
          Show more ({rows.length - visible.length} remaining)
        </button>
      )}
    </div>
  );
}
