"use client";

import { ChevronDown, ChevronUp, Loader2, Printer, RotateCcw, TriangleAlert, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import type { PrintDetail } from "@/lib/print-progress-types";
import {
  notifyPrintChanged,
  PrintDetailTable,
  ProgressBar,
  StatusPill,
  usePrintDetail,
} from "@/components/print-progress/print-progress-ui";
import PrintedConfirmation from "./printed-confirmation";

type Props = {
  batchId: number;
  batchCode: string;
  csrfToken: string;
  printedAt: string | null;
  initial: PrintDetail | null;
};

async function preparePages() {
  await document.fonts.ready;
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".print-page img"));
  await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  if (images.some((image) => image.naturalWidth === 0)) {
    throw new Error("A card image did not finish loading.");
  }
}

/** Marks only the sets in this run as printable, then opens the print dialog. */
function printSets(sets: Set<number>) {
  const root = document.documentElement;
  const pages = Array.from(document.querySelectorAll<HTMLElement>(".print-page"));
  const cleanup = () => {
    root.removeAttribute("data-print-run");
    pages.forEach((page) => page.removeAttribute("data-skip"));
    window.removeEventListener("afterprint", cleanup);
  };
  pages.forEach((page) => page.setAttribute("data-skip", sets.has(Number(page.dataset.set)) ? "false" : "true"));
  root.setAttribute("data-print-run", "1");
  window.addEventListener("afterprint", cleanup);
  window.print();
  // Some browsers never fire afterprint; print() has returned by now so it is safe to reset.
  window.setTimeout(cleanup, 1500);
}

export default function PrintWorkflow({ batchId, batchCode, csrfToken, printedAt, initial }: Props) {
  const { detail, setDetail, error: liveError, reload } = usePrintDetail(batchId, initial, !printedAt);
  const [busy, setBusy] = useState<"" | "print" | "review">("");
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const inFlight = useRef(false);

  async function call(action: "start" | "complete" | "cancel", scope?: "all" | number) {
    const response = await fetch("/api/admin/print-progress", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ batchId, action, scope }),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; detail?: PrintDetail } | null;
    if (!response.ok || !data?.ok || !data.detail) {
      throw new Error(data?.error || "Could not update print progress. Refresh and try again.");
    }
    setDetail(data.detail);
    notifyPrintChanged();
    return data.detail;
  }

  async function startRun(scope: "all" | number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("print");
    setError("");
    try {
      await preparePages();
      const next = await call("start", scope);
      const sets = new Set(next.items.filter((item) => item.state === "printing").map((item) => item.setNo));
      printSets(sets);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Printing could not start.");
      void reload();
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  async function review(action: "complete" | "cancel") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("review");
    setError("");
    try {
      await call(action);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your answer.");
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  if (!detail) {
    return (
      <section className="no-print mx-auto mb-4 max-w-4xl rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <p className="text-muted text-xs">{liveError || "Loading print progress…"}</p>
      </section>
    );
  }

  const locked = Boolean(printedAt) || detail.status === "completed";
  const waiting = detail.printing > 0;
  const setCount = Math.ceil(detail.total / detail.setSize);
  const setStates = Array.from({ length: setCount }, (_, index) => {
    const rows = detail.items.filter((item) => item.setNo === index + 1);
    return {
      no: index + 1,
      size: rows.length,
      printed: rows.filter((row) => row.state === "printed").length,
      printing: rows.filter((row) => row.state === "printing").length,
    };
  });

  return (
    <>
      <section className="no-print mx-auto mb-4 max-w-4xl rounded-lg border px-4 py-4 text-sm" style={{ borderColor: "var(--line)", background: "var(--card)" }} aria-label="Print progress">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">Print progress</h2>
            <StatusPill status={detail.status} />
          </div>
          <p className="text-xs font-semibold">
            {detail.printed} of {detail.total} printed · {detail.percent}%
          </p>
        </div>
        <div className="mt-2">
          <ProgressBar printed={detail.printed} printing={detail.printing} total={detail.total} label={`Batch ${batchCode} print progress`} />
        </div>
        <p className="text-muted mt-1.5 text-xs">
          {detail.printed} printed · {detail.printing} printing now · {detail.queued} left in queue
        </p>

        {!locked && (
          <>
            {waiting ? (
              <div className="mt-3 rounded-md border px-3 py-3" style={{ borderColor: "var(--accent-gold)", background: "var(--bg)" }} role="status">
                <p className="text-xs font-bold">Did the {detail.printing} card{detail.printing === 1 ? "" : "s"} print correctly?</p>
                <p className="text-muted mt-1 text-xs leading-relaxed">
                  Check the physical cards (front and back, alignment, no jams). Only confirm what actually came out of the printer.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => review("complete")} disabled={busy !== ""}>
                    {busy === "review" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    Yes, mark as printed
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => review("cancel")} disabled={busy !== ""}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> No, put back in queue
                  </button>
                </div>
              </div>
            ) : detail.queued > 0 ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={() => {
                      const next = setStates.find((entry) => entry.printed < entry.size);
                      if (next) void startRun(next.no);
                    }}
                    disabled={busy !== ""}
                  >
                    {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
                    {busy === "print" ? "Preparing cards…" : "Print next set"}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => startRun("all")} disabled={busy !== ""}>
                    Print all remaining ({detail.queued})
                  </button>
                </div>
                <p className="text-muted mt-2 text-xs leading-relaxed">
                  Each set is {detail.setSize} cards (one A4 sheet, front and back). Printing one set at a time lets you check the output before continuing.
                </p>
                {setCount > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Print a specific set">
                    {setStates.map((entry) => {
                      const done = entry.printed === entry.size;
                      return (
                        <button
                          key={entry.no}
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busy !== "" || done}
                          onClick={() => startRun(entry.no)}
                          title={done ? "Already printed" : `Print set ${entry.no}`}
                        >
                          Set {entry.no}
                          {done ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}

        {(error || liveError) && (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: "var(--danger)" }}>
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error || liveError}
          </p>
        )}

        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => setShowTable((value) => !value)} aria-expanded={showTable}>
          {showTable ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          {showTable ? "Hide record progress" : "Show record progress"}
        </button>
        {showTable && (
          <div className="mt-2">
            <PrintDetailTable detail={detail} />
          </div>
        )}
      </section>

      <PrintedConfirmation
        batchId={batchId}
        batchCode={batchCode}
        cardCount={detail.total}
        printedAt={printedAt}
        csrfToken={csrfToken}
        ready={detail.status === "ready"}
      />
    </>
  );
}
