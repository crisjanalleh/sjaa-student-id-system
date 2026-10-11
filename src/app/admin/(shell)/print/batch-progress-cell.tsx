"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import type { PrintSummary } from "@/lib/print-progress-types";
import { DetailModal } from "@/components/print-progress/print-progress-dock";
import { ProgressBar } from "@/components/print-progress/print-progress-ui";

const SHORT: Record<PrintSummary["status"], string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  printing: "Printing",
  ready: "Ready",
  completed: "Done",
};

/** One compact line: thin bar, percent, count, and a small details button. */
export default function BatchProgressCell({ batchId, summary }: { batchId: number; summary: PrintSummary | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-48 items-center gap-2">
      {summary && (
        <>
          <div className="w-20 shrink-0">
            <ProgressBar printed={summary.printed} printing={summary.printing} total={summary.total} label="Print progress" thin />
          </div>
          <span className="whitespace-nowrap text-xs font-bold">{summary.percent}%</span>
          <span className="text-muted whitespace-nowrap text-[11px]">
            {summary.printed}/{summary.total} · {SHORT[summary.status]}
          </span>
        </>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm !h-7 !w-7 !p-0"
        onClick={() => setOpen(true)}
        aria-label="View print progress details"
        title="View progress"
      >
        <Eye className="h-4 w-4" aria-hidden />
      </button>
      {open && <DetailModal batchId={batchId} onClose={() => setOpen(false)} />}
    </div>
  );
}
