"use client";

import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type MonthBucket = { label: string; fullName: string; total: number; future: boolean };

type Props = {
  months: MonthBucket[];
  year: number;
  earliestYear: number;
  currentYear: number;
};

const H = 220;
const PAD = { top: 18, right: 12, bottom: 38, left: 40 };

function niceMax(value: number) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

const nf = (n: number) => n.toLocaleString("en-US");

export default function MonthlySubmissions({ months, year, earliestYear, currentYear }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const hasData = months.some((m) => m.total > 0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasData]);

  const stats = useMemo(() => {
    const total = months.reduce((s, m) => s + m.total, 0);
    const max = Math.max(...months.map((m) => m.total));
    // Ties resolve to the earliest month so the label is stable.
    const peak = total > 0 ? months.findIndex((m) => m.total === max) : -1;
    return { total, max, peak, average: total / 12 };
  }, [months]);

  const yMax = niceMax(stats.max);
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const col = plotW / 12;
  const barW = Math.min(36, col * 0.6);
  const compact = col < 44;
  const x = (i: number) => PAD.left + col * i + col / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const tip = active !== null ? months[active] : null;

  const summary = [
    { label: "Received this year", value: nf(stats.total) },
    { label: "Monthly average", value: stats.average.toLocaleString("en-US", { maximumFractionDigits: 1 }) },
    {
      label: "Busiest month",
      value: stats.peak >= 0 ? `${months[stats.peak].fullName} · ${nf(months[stats.peak].total)}` : "None yet",
    },
  ];

  return (
    <section className="card" aria-labelledby="monthly-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div className="min-w-0">
          <h2 id="monthly-title" className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            </span>
            Monthly application submissions
          </h2>
          <p className="text-muted mt-0.5 text-xs">Applications received per month, by submission date.</p>
        </div>
        <nav className="flex items-center gap-1" aria-label="Choose reporting year">
          {year > earliestYear ? (
            <Link href={`/admin?year=${year - 1}`} className="btn btn-outline btn-sm" aria-label={`Show ${year - 1}`} scroll={false}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className="btn btn-outline btn-sm opacity-40" aria-hidden><ChevronLeft className="h-4 w-4" /></span>
          )}
          <span className="min-w-14 text-center text-sm font-bold tabular-nums" aria-live="polite">{year}</span>
          {year < currentYear ? (
            <Link href={`/admin?year=${year + 1}`} className="btn btn-outline btn-sm" aria-label={`Show ${year + 1}`} scroll={false}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className="btn btn-outline btn-sm opacity-40" aria-hidden><ChevronRight className="h-4 w-4" /></span>
          )}
        </nav>
      </div>

      <dl className="grid grid-cols-1 gap-3 border-b border-[var(--line)] px-5 py-3.5 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-muted text-[11px] font-semibold uppercase tracking-wide">{item.label}</dt>
            <dd className="mt-0.5 truncate text-lg font-extrabold tabular-nums text-[var(--ink)]">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="px-3 pb-4 pt-3 sm:px-5">
        {!hasData ? (
          <p className="text-muted py-10 text-center text-sm">No applications were submitted in {year}.</p>
        ) : (
          <div ref={wrap} className="relative" onMouseLeave={() => setActive(null)}>
            <svg
              viewBox={`0 0 ${width} ${H}`}
              width={width}
              height={H}
              className="block h-auto w-full"
              role="group"
              aria-label={`Applications received per month in ${year}`}
            >
              {ticks.map((t) => {
                const y = PAD.top + plotH - (t / yMax) * plotH;
                return (
                  <g key={t}>
                    <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} />
                    <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
                  </g>
                );
              })}
              <text x={10} y={PAD.top + plotH / 2} fontSize="10" fill="var(--muted)" textAnchor="middle" transform={`rotate(-90 10 ${PAD.top + plotH / 2})`}>
                Applications
              </text>
              {months.map((m, i) => {
                const h = m.total > 0 ? Math.max((m.total / yMax) * plotH, 2) : 0;
                const isActive = active === i;
                return (
                  <g
                    key={m.label}
                    opacity={m.future ? 0.45 : 1}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    tabIndex={0}
                    role="img"
                    aria-label={`${m.fullName} ${year}: ${m.total} ${m.total === 1 ? "application" : "applications"}`}
                    style={{ outline: "none" }}
                  >
                    <rect x={x(i) - col / 2} y={PAD.top} width={col} height={plotH + 20} fill={isActive ? "var(--academic-blue)" : "transparent"} opacity={isActive ? 0.07 : 1} rx="6" />
                    <rect
                      x={x(i) - barW / 2}
                      y={PAD.top + plotH - h}
                      width={barW}
                      height={h}
                      rx="4"
                      fill="var(--academic-blue)"
                      opacity={active === null || isActive ? 1 : 0.55}
                      style={{ transition: "opacity .15s" }}
                    />
                    {m.total > 0 && (
                      <text x={x(i)} y={PAD.top + plotH - h - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink)">
                        {m.total}
                      </text>
                    )}
                    <text x={x(i)} y={PAD.top + plotH + 16} textAnchor="middle" fontSize="10.5" fontWeight={isActive ? 700 : 500} fill={isActive ? "var(--ink)" : "var(--muted)"}>
                      {compact ? m.label.slice(0, 1) : m.label}
                    </text>
                  </g>
                );
              })}
              <text x={PAD.left + plotW / 2} y={H - 3} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
                Month of {year}
              </text>
            </svg>
            {tip && active !== null && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--elevated)] px-3 py-2 text-xs shadow-lg"
                style={{ left: `${Math.min(88, Math.max(12, (x(active) / width) * 100))}%`, top: 0 }}
                role="status"
              >
                <p className="font-bold text-[var(--ink)]">{tip.fullName} {year}</p>
                <p className="text-muted tabular-nums">
                  {nf(tip.total)} {tip.total === 1 ? "application" : "applications"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
