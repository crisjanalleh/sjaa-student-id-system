import type { PrintSummary } from "@/lib/print-progress-types";
import { ProgressBar } from "@/components/print-progress/print-progress-ui";

const SHORT: Record<PrintSummary["status"], string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  printing: "Printing",
  ready: "Ready",
  completed: "Done",
};

const STATUS_TONE: Record<PrintSummary["status"], string> = {
  "not-started": "var(--muted)",
  "in-progress": "var(--academic-blue)",
  printing: "var(--accent-gold)",
  ready: "var(--academic-blue)",
  completed: "var(--success)",
};

/** Compact progress: bar + percent, status dot with count. The whole row opens the details. */
export default function BatchProgressCell({ summary }: { summary: PrintSummary | null }) {
  if (!summary) return <span className="text-muted text-xs">No progress yet</span>;
  return (
    <div className="min-w-56">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ProgressBar printed={summary.printed} printing={summary.printing} total={summary.total} label="Print progress" thin />
        </div>
        <span className="text-xs font-extrabold tabular-nums">{summary.percent}%</span>
      </div>
      <p className="text-muted mt-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_TONE[summary.status] }} aria-hidden />
        <span className="tabular-nums">{summary.printed}/{summary.total}</span> printed · {SHORT[summary.status]}
      </p>
    </div>
  );
}
