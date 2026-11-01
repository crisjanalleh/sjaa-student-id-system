"use client";

import { RefreshCw } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import type { UnreadCounts, UnreadSection } from "@/lib/unread";

export type LiveSync = {
  unread: UnreadCounts;
  /** Marks a section read and reloads the page data so new records appear. */
  viewNew: (section: UnreadSection) => Promise<void>;
};

export const LiveSyncContext = createContext<LiveSync | null>(null);

type Tone = "active" | "new" | "idle";

// Green = active/healthy, amber = something new needs a look, grey = nothing on record.
const DOT: Record<Tone, string> = {
  active: "bg-[var(--indicator-active)]",
  new: "bg-[var(--new-bg)]",
  idle: "bg-[var(--line-strong)]",
};

const PILL =
  "inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-xs";

/** Card-style pill with a coloured status dot. */
export function StatusPill({ tone = "active", pulse = false, children }: { tone?: Tone; pulse?: boolean; children: ReactNode }) {
  return (
    <div className={PILL}>
      <span className="relative flex h-2 w-2" aria-hidden>
        {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${DOT[tone]}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${DOT[tone]}`} />
      </span>
      {children}
    </div>
  );
}

/** Header count pill: total records plus a live "new" pill that clears once the new records are viewed. */
export default function CountIndicator({
  section,
  total,
  singular,
  plural,
}: {
  section: UnreadSection;
  total: number;
  singular: string;
  plural?: string;
}) {
  const live = useContext(LiveSyncContext);
  const fresh = live?.unread[section] ?? 0;
  const label = total === 1 ? singular : plural ?? `${singular}s`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill tone={total > 0 ? "active" : "idle"}>
        <span className="tabular-nums">{total.toLocaleString()}</span> {label}
      </StatusPill>
      {fresh > 0 && live && (
        <button
          type="button"
          className="new-chip"
          onClick={() => void live.viewNew(section)}
          aria-live="polite"
          title="Show the new records"
        >
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--new-bg)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--new-bg)]" />
          </span>
          <span className="tabular-nums">{fresh > 999 ? "999+" : fresh}</span> new
          <RefreshCw className="h-3 w-3 opacity-70" aria-hidden />
          Refresh
        </button>
      )}
    </div>
  );
}
