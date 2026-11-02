"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Printer,
  RotateCcw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PrintDetail } from "@/lib/print-progress-types";
import {
  notifyPrintChanged,
  PrintDetailTable,
  ProgressBar,
  StatusPill,
  usePrintDetail,
} from "@/components/print-progress/print-progress-ui";
import PrintedConfirmation from "./printed-confirmation";
import PrinterCheck from "./printer-check";

type Props = {
  batchId: number;
  batchCode: string;
  csrfToken: string;
  printedAt: string | null;
  initial: PrintDetail | null;
  orientation: string;
  missingPhotos: number;
  frontSets: ReactNode[];
  backSets: ReactNode[];
  notice: ReactNode;
};

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

async function imageReady(image: HTMLImageElement) {
  const decoded = await Promise.race([
    image.decode().then(() => true, () => false),
    delay(20000).then(() => false),
  ]);
  return decoded && image.naturalWidth > 0;
}

/** Waits for every card image in the given sets; broken photos are re-requested twice before giving up. */
async function preparePages(sets: number[]) {
  if (sets.length === 0) return;
  await document.fonts.ready;
  const selector = sets.map((set) => `.print-page[data-set="${set}"] img`).join(",");
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(selector));
    const ok = await Promise.all(images.map(imageReady));
    const broken = images.filter((_, index) => !ok[index]);
    if (broken.length === 0) return;
    if (attempt === 2) {
      throw new Error(
        `${broken.length} card photo${broken.length === 1 ? "" : "s"} could not be loaded, so nothing was sent to the printer. Check your connection and press Retry.`,
      );
    }
    broken.forEach((image) => {
      const url = new URL(image.currentSrc || image.src, window.location.href);
      url.searchParams.set("retry", String(attempt + 1));
      image.src = url.toString();
    });
    await delay(500 * (attempt + 1));
  }
}

/** Marks only the sets in this run as printable, then opens the print dialog. */
function printSets(sets: Set<number>, mode: "run" | "test" = "run") {
  const root = document.documentElement;
  const pages = Array.from(document.querySelectorAll<HTMLElement>(".print-page"));
  const cleanup = () => {
    root.removeAttribute("data-print-run");
    pages.forEach((page) => page.removeAttribute("data-skip"));
    window.removeEventListener("afterprint", cleanup);
  };
  pages.forEach((page) => page.setAttribute("data-skip", sets.has(Number(page.dataset.set)) ? "false" : "true"));
  root.setAttribute("data-print-run", mode === "test" ? "test" : "1");
  window.addEventListener("afterprint", cleanup);
  window.print();
  // Some browsers never fire afterprint; print() has returned by now so it is safe to reset.
  window.setTimeout(cleanup, 1500);
}

export default function PrintWorkflow({
  batchId,
  batchCode,
  csrfToken,
  printedAt,
  initial,
  orientation,
  missingPhotos,
  frontSets,
  backSets,
  notice,
}: Props) {
  const { detail, setDetail, error: liveError, reload } = usePrintDetail(batchId, initial, !printedAt);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<"" | "print" | "review">("");
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [problemSets, setProblemSets] = useState<Set<number>>(new Set());
  const [forceSets, setForceSets] = useState<number[]>([]);
  const [previewSet, setPreviewSet] = useState(() => {
    if (!initial) return 1;
    const count = Math.ceil(initial.total / initial.setSize);
    for (let no = 1; no <= count; no += 1) {
      const rows = initial.items.filter((item) => item.setNo === no);
      if (rows.some((row) => row.state !== "printed")) return no;
    }
    return 1;
  });
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    void document.fonts.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  async function call(action: "start" | "complete" | "cancel" | "reprint", extra: Record<string, unknown> = {}, retries = 0) {
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch("/api/admin/print-progress", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ batchId, action, ...extra }),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; detail?: PrintDetail } | null;
        if (!response.ok || !data?.ok || !data.detail) {
          // The first attempt may have been saved even though its reply was lost; trust the saved state.
          if (attempt > 0 && response.status === 409 && (action === "complete" || action === "cancel")) {
            await reload();
            return null;
          }
          throw Object.assign(new Error(data?.error || "Could not update print progress. Refresh and try again."), { fatal: true });
        }
        setDetail(data.detail);
        notifyPrintChanged();
        return data.detail;
      } catch (caught) {
        if ((caught as { fatal?: boolean }).fatal || attempt >= retries) throw caught;
        await delay(600 * 2 ** attempt);
      } finally {
        window.clearTimeout(timer);
      }
    }
  }

  async function startRun(scope: "all" | number) {
    if (inFlight.current || !detail) return;
    if (!navigator.onLine) {
      setError("You are offline. Reconnect first so this run is saved before cards are sent to the printer.");
      return;
    }
    inFlight.current = true;
    setBusy("print");
    setError("");
    setConfirmAll(false);
    try {
      const targets = Array.from(new Set(detail.items.filter((item) => item.state === "queued").map((item) => item.setNo)))
        .filter((setNo) => scope === "all" || setNo === scope)
        .sort((a, b) => a - b);
      setForceSets(targets);
      await nextFrame();
      await nextFrame();
      await preparePages(targets);
      let next: PrintDetail | null;
      try {
        next = await call("start", { scope });
      } catch (caught) {
        void reload();
        throw caught;
      }
      const sets = new Set((next ?? detail).items.filter((item) => item.state === "printing").map((item) => item.setNo));
      setProblemSets(new Set());
      printSets(sets);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name !== "AbortError"
          ? caught.message
          : "The server did not answer in time. Nothing was sent to the printer. Press Retry.",
      );
      void reload();
    } finally {
      inFlight.current = false;
      setForceSets([]);
      setBusy("");
    }
  }

  async function printAgain(sets: number[]) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("print");
    setError("");
    try {
      setForceSets(sets);
      await nextFrame();
      await nextFrame();
      await preparePages(sets);
      printSets(new Set(sets));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Printing could not start.");
    } finally {
      inFlight.current = false;
      setForceSets([]);
      setBusy("");
    }
  }

  async function testPrint() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await document.fonts.ready;
      printSets(new Set(), "test");
    } finally {
      inFlight.current = false;
    }
  }

  async function review(action: "complete" | "cancel", failed: number[] = []) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("review");
    setError("");
    try {
      await call(action, action === "complete" ? { failedSets: failed } : {}, 3);
      setProblemSets(new Set());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `${caught.message} Your print progress is saved; press the button again.`
          : "Could not save your answer. Your print progress is saved; try again.",
      );
      void reload();
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  async function reprint(setNo: number) {
    if (inFlight.current) return;
    if (!window.confirm(`Put Set ${setNo} back in the queue so it can be printed again?`)) return;
    inFlight.current = true;
    setBusy("review");
    setError("");
    try {
      await call("reprint", { sets: [setNo] }, 2);
      setPreviewSet(setNo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not put that set back in the queue.");
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
  const printingSets = setStates.filter((entry) => entry.printing > 0).map((entry) => entry.no);
  const queuedSets = setStates.filter((entry) => entry.printed + entry.printing < entry.size).length;
  const safePreview = Math.min(Math.max(1, previewSet), Math.max(1, setCount));
  const mounted = Array.from(new Set([...printingSets, ...forceSets, safePreview])).sort((a, b) => a - b);
  const failedList = printingSets.filter((no) => problemSets.has(no));
  const goodSets = printingSets.length - failedList.length;
  const disabled = busy !== "" || !online;

  return (
    <>
      <PrinterCheck online={online} fontsReady={fontsReady} missingPhotos={missingPhotos} onTestPrint={() => void testPrint()} busy={busy !== ""} />

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
          {!locked && " · progress is saved after every step"}
        </p>

        {!online && (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--danger)" }}>
            <WifiOff className="h-3.5 w-3.5" aria-hidden /> You are offline. Printing is paused and nothing is lost.
          </p>
        )}

        {!locked && (
          <>
            {waiting ? (
              <div className="mt-3 rounded-md border px-3 py-3" style={{ borderColor: "var(--accent-gold)", background: "var(--bg)" }} role="status">
                <p className="text-xs font-bold">Did the {detail.printing} card{detail.printing === 1 ? "" : "s"} print correctly?</p>
                <p className="text-muted mt-1 text-xs leading-relaxed">
                  Check the physical cards (front and back, alignment, no jams). If one set had a problem, mark just that set and the rest stays saved.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Mark sets with a problem">
                  {printingSets.map((no) => {
                    const bad = problemSets.has(no);
                    return (
                      <button
                        key={no}
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={bad ? { borderColor: "var(--danger)", color: "var(--danger)" } : { borderColor: "var(--success)", color: "var(--success)" }}
                        aria-pressed={bad}
                        disabled={busy !== ""}
                        onClick={() =>
                          setProblemSets((current) => {
                            const copy = new Set(current);
                            if (copy.has(no)) copy.delete(no);
                            else copy.add(no);
                            return copy;
                          })
                        }
                      >
                        Set {no}: {bad ? "problem" : "printed OK"}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => (goodSets === 0 ? review("cancel") : review("complete", failedList))}
                    disabled={busy !== ""}
                  >
                    {busy === "review" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    {failedList.length === 0
                      ? "Yes, mark as printed"
                      : goodSets === 0
                        ? "Put all back in queue"
                        : `Mark ${goodSets} set${goodSets === 1 ? "" : "s"} printed, requeue ${failedList.length}`}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void printAgain(printingSets)} disabled={disabled}>
                    <Printer className="h-4 w-4" aria-hidden /> Print again (printer problem)
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
                    disabled={disabled}
                  >
                    {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
                    {busy === "print" ? "Preparing cards…" : error ? "Retry next set" : "Print next set"}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmAll(true)} disabled={disabled}>
                    Print all remaining ({detail.queued})
                  </button>
                </div>
                {confirmAll && (
                  <div className="mt-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--accent-gold)" }} role="alertdialog" aria-label="Confirm printing all remaining">
                    <p className="font-semibold">
                      Print {detail.queued} cards in {queuedSets} set{queuedSets === 1 ? "" : "s"}?
                    </p>
                    <p className="text-muted mt-0.5">
                      Load at least {queuedSets * 2} sheets of A4 (front and back of each set). If the printer jams you can mark only the failed set afterwards.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn btn-gold btn-sm" onClick={() => void startRun("all")} disabled={disabled}>
                        Start printing
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmAll(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
                          disabled={disabled || done}
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

            {!waiting && setStates.some((entry) => entry.printed > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Reprint a set">
                <span className="text-muted text-xs">Printed a set wrong? Reprint:</span>
                {setStates
                  .filter((entry) => entry.printed > 0)
                  .map((entry) => (
                    <button key={entry.no} type="button" className="btn btn-ghost btn-sm" disabled={busy !== ""} onClick={() => void reprint(entry.no)}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Set {entry.no}
                    </button>
                  ))}
              </div>
            )}
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

      {notice}

      {setCount === 0 ? (
        <p className="no-print px-4 py-10 text-center text-sm">This batch contains no records.</p>
      ) : (
        <div className="print-output-wrapper mx-auto w-fit px-2 pb-10">
          <div className="no-print mb-2 mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewSet(Math.max(1, safePreview - 1))} disabled={safePreview <= 1} aria-label="Previous set">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-xs font-semibold">
              Previewing set {safePreview} of {setCount}
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreviewSet(Math.min(setCount, safePreview + 1))} disabled={safePreview >= setCount} aria-label="Next set">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-muted text-xs">Only the sets being previewed or printed are loaded, which keeps large batches fast.</span>
          </div>
          <h2 className="no-print lbl !mb-3 !mt-4">Front sheet</h2>
          <div className="print-sheet" data-orientation={orientation}>
            {mounted.map((setNo) => (
              <div key={`front-page-${setNo}`} className="print-page" data-set={setNo} data-orientation={orientation}>
                {frontSets[setNo - 1]}
              </div>
            ))}
          </div>

          <h2 className="no-print lbl !mb-3 !mt-6">Back sheet</h2>
          <div className="print-sheet print-back-sheet" data-orientation={orientation}>
            {mounted.map((setNo) => (
              <div key={`back-page-${setNo}`} className="print-page" data-set={setNo} data-orientation={orientation}>
                {backSets[setNo - 1]}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="print-test" aria-hidden>
        <h1 style={{ fontSize: "14pt", fontWeight: 700 }}>SJAA ID printer test page</h1>
        <p style={{ fontSize: "10pt", marginTop: "2mm" }}>
          Paper A4 · scale 100% · headers and footers off. If the bar below does not measure exactly 100 mm, fix the scale in the print dialog before printing real cards.
        </p>
        <div style={{ width: "100mm", height: "8mm", marginTop: "6mm", background: "#000", color: "#fff", fontSize: "9pt", display: "flex", alignItems: "center", justifyContent: "center" }}>
          100 mm
        </div>
        <div style={{ display: "flex", gap: "10mm", marginTop: "8mm", alignItems: "flex-start" }}>
          <div style={{ width: "53.98mm", height: "85.6mm", border: "0.3mm dashed #000", fontSize: "8pt", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            Card size
            <br />
            53.98 × 85.60 mm
          </div>
          <p style={{ fontSize: "10pt", maxWidth: "90mm" }}>
            Lay a printed ID card over the dashed outline. It should fit exactly. Text and edges must be sharp, with no streaks or missing colors.
          </p>
        </div>
      </div>
    </>
  );
}
