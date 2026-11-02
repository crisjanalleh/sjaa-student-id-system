"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Parts = { y: number; m: number; d: number; h: number; min: number };
export type DatePreset = { label: string; offsetDays: number };

const pad = (n: number) => String(n).padStart(2, "0");

function parse(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return null;
  return { y: +match[1], m: +match[2], d: +match[3], h: match[4] ? +match[4] : 0, min: match[5] ? +match[5] : 0 };
}

function serialize(p: Parts, withTime: boolean): string {
  const date = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  return withTime ? `${date}T${pad(p.h)}:${pad(p.min)}` : date;
}

function display(p: Parts, withTime: boolean): string {
  const date = `${MONTHS[p.m - 1].slice(0, 3)} ${p.d}, ${p.y}`;
  if (!withTime) return date;
  const hour12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${date} · ${hour12}:${pad(p.min)} ${p.h >= 12 ? "PM" : "AM"}`;
}

const dayKey = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;

function todayParts(): Parts {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate(), h: now.getHours(), min: now.getMinutes() };
}

type PickerProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  mode?: "date" | "datetime";
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  presets?: DatePreset[];
  defaultTime?: string;
  ariaLabel?: string;
};

export default function DateTimePicker({
  id,
  name,
  value: controlled,
  defaultValue = "",
  onValueChange,
  mode = "date",
  min,
  max,
  placeholder,
  required,
  presets,
  defaultTime = "23:59",
  ariaLabel,
}: PickerProps) {
  const withTime = mode === "datetime";
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const selected = parse(value);
  const minParts = min ? parse(min) : null;
  const maxParts = max ? parse(max) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const base = selected ?? todayParts();
    return { y: base.y, m: base.m };
  });
  const [panel, setPanel] = useState<"days" | "months">("days");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const commit = useCallback(
    (next: string) => {
      setInner(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(312, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const height = popRef.current?.offsetHeight ?? 420;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8 && rect.top - height - 6 > 8) top = rect.top - height - 6;
    setPos({ top: Math.max(8, top), left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, panel, withTime]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const base = selected ?? todayParts();
      setView({ y: base.y, m: base.m });
      setPanel("days");
    }
    setOpen((o) => !o);
  }

  const isDisabled = (y: number, m: number, d: number) => {
    const key = dayKey(y, m, d);
    return Boolean((minParts && key < dayKey(minParts.y, minParts.m, minParts.d)) || (maxParts && key > dayKey(maxParts.y, maxParts.m, maxParts.d)));
  };

  function pickDay(y: number, m: number, d: number) {
    if (isDisabled(y, m, d)) return;
    const [dh, dm] = defaultTime.split(":").map(Number);
    const time = selected ?? { h: withTime ? dh : 0, min: withTime ? dm : 0 };
    commit(serialize({ y, m, d, h: time.h, min: time.min }, withTime));
    if (!withTime) setOpen(false);
  }

  function setTime(patch: Partial<Pick<Parts, "h" | "min">>) {
    const base = selected ?? { ...todayParts(), h: 0, min: 0 };
    commit(serialize({ ...base, ...patch }, true));
  }

  function applyPreset(preset: DatePreset) {
    const date = new Date();
    date.setDate(date.getDate() + preset.offsetDays);
    const [dh, dm] = defaultTime.split(":").map(Number);
    const next = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), h: withTime ? dh : 0, min: withTime ? dm : 0 };
    commit(serialize(next, withTime));
    setView({ y: next.y, m: next.m });
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const index = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(index / 12), m: (index % 12) + 1 };
    });
  }

  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = todayParts();
  const hour12 = selected ? (selected.h % 12 === 0 ? 12 : selected.h % 12) : 12;
  const meridiem = selected && selected.h >= 12 ? "PM" : "AM";

  const setHour12 = (h12: number, mer: string) => setTime({ h: (h12 % 12) + (mer === "PM" ? 12 : 0) });

  const chip =
    "rounded-full border border-[var(--line)] bg-[var(--elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--academic-blue)] hover:text-[var(--academic-blue)]";

  const popover: ReactNode =
    open && pos ? (
      <div
        ref={popRef}
        role="dialog"
        aria-label={withTime ? "Choose date and time" : "Choose date"}
        className="dtp-pop fixed z-[80] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-2xl"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        <div className="flex items-center justify-between gap-1 border-b border-[var(--line)] px-3 py-2.5">
          <button type="button" className="dtp-nav" aria-label="Previous month" onClick={() => (panel === "months" ? setView((v) => ({ ...v, y: v.y - 1 })) : shiftMonth(-1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-[var(--academic-blue)]/10"
            onClick={() => setPanel((p) => (p === "days" ? "months" : "days"))}
            aria-live="polite"
          >
            {panel === "days" ? `${MONTHS[view.m - 1]} ${view.y}` : view.y}
          </button>
          <button type="button" className="dtp-nav" aria-label="Next month" onClick={() => (panel === "months" ? setView((v) => ({ ...v, y: v.y + 1 })) : shiftMonth(1))}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {panel === "months" ? (
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {MONTHS.map((month, i) => (
              <button
                key={month}
                type="button"
                className={`dtp-month ${view.m === i + 1 ? "is-active" : ""}`}
                onClick={() => {
                  setView({ y: view.y, m: i + 1 });
                  setPanel("days");
                }}
              >
                {month.slice(0, 3)}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-1 grid grid-cols-7 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-muted py-1 text-[10.5px] font-bold uppercase tracking-wide">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5" role="grid">
              {cells.map((day, i) => {
                if (day === null) return <span key={`blank-${i}`} />;
                const isSelected = selected && selected.y === view.y && selected.m === view.m && selected.d === day;
                const isToday = today.y === view.y && today.m === view.m && today.d === day;
                const disabled = isDisabled(view.y, view.m, day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    aria-pressed={Boolean(isSelected)}
                    aria-label={`${MONTHS[view.m - 1]} ${day}, ${view.y}`}
                    onClick={() => pickDay(view.y, view.m, day)}
                    className={`dtp-day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {withTime && panel === "days" && (
          <div className="space-y-2.5 border-t border-[var(--line)] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Time
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Hour"
                className="inp !h-9 !w-[4.25rem] !px-2 text-center text-sm font-semibold"
                value={hour12}
                onChange={(e) => setHour12(Number(e.target.value), meridiem)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span className="font-bold text-[var(--muted)]">:</span>
              <select
                aria-label="Minute"
                className="inp !h-9 !w-[4.25rem] !px-2 text-center text-sm font-semibold"
                value={selected?.min ?? 0}
                onChange={(e) => setTime({ min: Number(e.target.value) })}
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
              <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[var(--line)]" role="group" aria-label="AM or PM">
                {["AM", "PM"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={meridiem === m}
                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${meridiem === m ? "bg-[var(--academic-blue)] text-white" : "bg-[var(--elevated)] text-[var(--ink)] hover:bg-[var(--academic-blue)]/10"}`}
                    onClick={() => setHour12(hour12, m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["8:00 AM", 8, 0],
                ["12:00 PM", 12, 0],
                ["5:00 PM", 17, 0],
                ["11:59 PM", 23, 59],
              ].map(([label, h, m]) => (
                <button key={label as string} type="button" className={chip} onClick={() => setTime({ h: h as number, min: m as number })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--bg)]/40 px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={chip}
              onClick={() => {
                const t = todayParts();
                setView({ y: t.y, m: t.m });
                setPanel("days");
                pickDay(t.y, t.m, t.d);
              }}
            >
              Today
            </button>
            {presets?.map((preset) => (
              <button key={preset.label} type="button" className={chip} onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
          {withTime && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)} disabled={!selected}>
              Done
            </button>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="inp flex w-full items-center gap-2 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-required={required}
        onClick={toggle}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--academic-blue)]" aria-hidden />
        <span className={`min-w-0 flex-1 truncate text-sm ${selected ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}>
          {selected ? display(selected, withTime) : placeholder ?? (withTime ? "Select date and time" : "Select date")}
        </span>
        {selected && !required && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            className="rounded-full p-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={(e) => {
              e.stopPropagation();
              commit("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                commit("");
              }
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </button>
      {typeof document !== "undefined" && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

/** Start and end date filters that cannot overlap incorrectly. */
export function DateRangeFields({
  from,
  to,
  fromLabel,
  toLabel,
}: {
  from: string;
  to: string;
  fromLabel: ReactNode;
  toLabel: ReactNode;
}) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  return (
    <>
      <div className="space-y-1">
        {fromLabel}
        <DateTimePicker id="a_from" name="from" value={start} onValueChange={setStart} max={end || undefined} placeholder="Any start date" />
      </div>
      <div className="space-y-1">
        {toLabel}
        <DateTimePicker id="a_to" name="to" value={end} onValueChange={setEnd} min={start || undefined} placeholder="Any end date" />
      </div>
    </>
  );
}
