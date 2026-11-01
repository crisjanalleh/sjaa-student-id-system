"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import StatusBadge from "@/components/status-badge";
import { fullName } from "@/lib/format";

type Result = {
  id: number;
  applicationCode: string;
  studentIdNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  gradeLevel: string | null;
  status: string;
};

export default function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results: Result[]; total: number };
        setResults(data.results);
        setTotal(data.total);
        setFailed(false);
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (id: number) => {
    setOpen(false);
    router.push(`/admin/applications/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && trimmed) {
      e.preventDefault();
      if (active >= 0 && results[active]) go(results[active].id);
      else {
        setOpen(false);
        router.push(`/admin/applications?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const showPanel = open && trimmed.length > 0;

  return (
    <div ref={rootRef} className="relative w-full sm:w-80 lg:w-96">
      <Search className="text-muted pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
      <input
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Search applications"
        autoComplete="off"
        maxLength={80}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search name, application code or student ID"
        className="inp global-search-input h-10 w-full rounded-full text-sm shadow-xs"
        style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {loading ? (
          <Loader2 className="text-muted h-4 w-4 animate-spin" aria-label="Searching" />
        ) : query ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setResults([]); setTotal(0); setOpen(false); }} className="text-muted hover:text-[var(--ink)]">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </span>

      {showPanel && (
        <div className="absolute right-0 z-40 mt-2 w-full min-w-[20rem] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-xl sm:min-w-[26rem]">
          <ul id={listId} role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto py-1.5">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r.id)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 ${i === active ? "bg-[var(--academic-blue)]/10" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--academic-blue)]/12 text-xs font-bold text-[var(--academic-blue)]">
                    {(r.firstName[0] ?? "").toUpperCase()}{(r.lastName[0] ?? "").toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">{fullName(r)}</span>
                    <span className="text-muted block truncate text-xs">
                      {r.applicationCode}{r.studentIdNumber ? ` · ${r.studentIdNumber}` : ""}{r.gradeLevel ? ` · ${r.gradeLevel}` : ""}
                    </span>
                  </span>
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
            {!loading && !failed && results.length === 0 && (
              <li role="presentation" className="text-muted px-4 py-6 text-center text-sm">No applications match &ldquo;{trimmed}&rdquo;.</li>
            )}
            {failed && <li role="presentation" className="px-4 py-4 text-center text-sm" style={{ color: "var(--danger)" }}>Search is unavailable. Try again.</li>}
          </ul>
          {total > results.length && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setOpen(false); router.push(`/admin/applications?q=${encodeURIComponent(trimmed)}`); }}
              className="w-full border-t border-[var(--line)] bg-[var(--bg)]/50 px-4 py-2.5 text-center text-xs font-semibold text-[var(--academic-blue)] hover:bg-[var(--bg)]"
            >
              View all {total.toLocaleString("en-US")} results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
