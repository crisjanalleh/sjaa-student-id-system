"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  IdCard,
  Printer,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_LABELS } from "@/lib/fields";

type StatusKey = "pending" | "approved" | "printed" | "claimed" | "rejected";

export type AnalyticsMonth = {
  label: string;
  future: boolean;
  total: number;
  byStatus: Record<StatusKey, number>;
};

type Props = {
  counts: Record<StatusKey | "total", number>;
  monthCount: number;
  claimedPercent: number;
  year: number;
  earliestYear: number;
  currentYear: number;
  months: AnalyticsMonth[];
};

const STATUS_ROWS: {
  key: StatusKey;
  label: string;
  description: string;
  action: boolean;
  Icon: typeof Clock3;
}[] = [
  { key: "pending", label: "Pending review", description: "Needs review", action: true, Icon: Clock3 },
  { key: "approved", label: "Approved", description: "Ready to print", action: true, Icon: CheckCircle2 },
  { key: "printed", label: "Printed", description: "Awaiting collection", action: false, Icon: Printer },
  { key: "claimed", label: "ID Claimed", description: "Handed over", action: false, Icon: IdCard },
  { key: "rejected", label: "Rejected", description: "Needs correction", action: false, Icon: XCircle },
];

// Bottom-to-top stacking order inside each monthly bar.
const STACK_ORDER: StatusKey[] = ["claimed", "printed", "approved", "pending", "rejected"];
const TABLE_ORDER: StatusKey[] = ["pending", "approved", "printed", "claimed", "rejected"];

const CX = 90;
const CY = 90;
const R = 84;
const BASE = 190;
const PLOT_H = 150;
const PAD_L = 40;
const PAD_R = 46;
const BAR_MAX = 38;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FULL_NAME_MIN_COL = 66;

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const num = (n: number) => n.toLocaleString("en-US");

export default function IssuanceAnalytics({
  counts,
  monthCount,
  claimedPercent,
  year,
  earliestYear,
  currentYear,
  months,
}: Props) {
  const [activeStatus, setActiveStatus] = useState<StatusKey | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const chartWrap = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(860);

  useEffect(() => {
    const el = chartWrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setChartW(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [months, year]);

  // Geometry follows the real container width, so the chart never stretches or squashes.
  const colW = (chartW - PAD_L - PAD_R) / 12;
  const barW = Math.min(BAR_MAX, colW * 0.62);
  const cx = (i: number) => PAD_L + i * colW + colW / 2;
  const compact = colW < FULL_NAME_MIN_COL;
  const monthName = (i: number) => MONTH_NAMES[i] ?? months[i].label;
  const monthTick = (i: number) => (compact ? monthName(i).slice(0, 3) : monthName(i));

  const stats = useMemo(() => {
    const yearTotal = months.reduce((s, m) => s + m.total, 0);
    const elapsed = months.filter((m) => !m.future).length || 1;
    const peakIndex = yearTotal ? months.reduce((best, m, i) => (m.total > months[best].total ? i : best), 0) : -1;
    const cumulative = months.map((_, i) =>
      months.slice(0, i + 1).reduce((s, m) => s + m.total, 0),
    );
    return {
      yearTotal,
      elapsed,
      peakIndex,
      cumulative,
      yearMax: Math.max(1, ...months.map((m) => m.total)),
      average: yearTotal / elapsed,
      claimed: months.reduce((s, m) => s + m.byStatus.claimed, 0),
      outstanding: months.reduce((s, m) => s + m.byStatus.pending + m.byStatus.approved, 0),
      byStatus: Object.fromEntries(
        STACK_ORDER.map((k) => [k, months.reduce((s, m) => s + m.byStatus[k], 0)]),
      ) as Record<StatusKey, number>,
    };
  }, [months]);

  const pieSlices = useMemo(() => {
    const active = STATUS_ROWS.filter(({ key }) => counts[key] > 0);
    const point = (a: number) => `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`;
    return active.map(({ key }, i) => {
      const before = active.slice(0, i).reduce((s, r) => s + counts[r.key], 0);
      const start = -Math.PI / 2 + (before / counts.total) * Math.PI * 2;
      const sweep = (counts[key] / counts.total) * Math.PI * 2;
      const end = start + sweep;
      return {
        key,
        full: counts[key] === counts.total,
        d: `M${CX} ${CY}L${point(start)}A${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(end - 0.0001)}Z`,
      };
    });
  }, [counts]);

  const needsAction = counts.pending + counts.approved;
  const dim = (key: StatusKey) => (activeStatus && activeStatus !== key ? 0.2 : 1);
  const hoveredMonth = hovered !== null ? months[hovered] : null;
  const tooltipLeft = hovered !== null ? Math.min(86, Math.max(14, (cx(hovered) / chartW) * 100)) : 0;

  function downloadCsv() {
    const header = ["Month", "Received", ...TABLE_ORDER.map((k) => STATUS_LABELS[k]), "Running total"];
    const lines = months.map((m, i) => [
      `${monthName(i)} ${year}`,
      m.total,
      ...TABLE_ORDER.map((k) => m.byStatus[k]),
      m.future ? "" : stats.cumulative[i],
    ]);
    lines.push(["Total", stats.yearTotal, ...TABLE_ORDER.map((k) => stats.byStatus[k]), stats.yearTotal]);
    const csv = [header, ...lines].map((row) => row.join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card mb-6 overflow-hidden" aria-labelledby="issuance-title">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--line)" }}>
        <div>
          <h2 id="issuance-title" className="text-sm font-bold">ID issuance overview</h2>
          <p className="text-muted mt-1 text-xs">
            <strong className="tabular-nums" style={{ color: "var(--ink)" }}>{counts.total}</strong> total applications
            {" · "}{monthCount} received this month. Select a status to open its records.
          </p>
        </div>
        <div className="text-right">
          <span className="text-muted block text-[11px] font-semibold uppercase tracking-wide">Cards collected</span>
          <span className="text-xl font-extrabold tabular-nums">{claimedPercent}%</span>
        </div>
      </div>

      {needsAction > 0 && (
        <div className="ax-action-banner" role="status">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-xs leading-snug">
            <strong className="text-sm">Action needed</strong>
            <span className="block sm:inline sm:before:content-['_·_']">
              {counts.pending > 0 && <>{counts.pending} awaiting review</>}
              {counts.pending > 0 && counts.approved > 0 && " and "}
              {counts.approved > 0 && <>{counts.approved} approved and ready to print</>}.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {counts.pending > 0 && (
              <Link href="/admin/applications?status=pending" className="btn btn-sm ax-action-btn">Review pending</Link>
            )}
            {counts.approved > 0 && (
              <Link href="/admin/print" className="btn btn-sm ax-action-btn">Go to batch print</Link>
            )}
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="grid items-center gap-6 md:grid-cols-[minmax(180px,0.75fr)_minmax(0,1.5fr)]">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold">Application status distribution</p>
            <svg
              viewBox="0 0 180 180"
              className="h-44 w-44"
              role="img"
              aria-label={`Status distribution: ${STATUS_ROWS.map((s) => `${s.label} ${counts[s.key]}`).join(", ")}`}
              style={{ color: "var(--ink)" }}
            >
              {counts.total === 0 ? (
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
              ) : (
                pieSlices.map(({ key, d, full }) =>
                  full ? (
                    <circle key={key} cx={CX} cy={CY} r={R} style={{ fill: `var(--st-${key})` }} stroke="var(--card)" strokeWidth="2" />
                  ) : (
                    <path
                      key={key}
                      d={d}
                      style={{ fill: `var(--st-${key})`, opacity: dim(key), transition: "opacity .15s" }}
                      stroke="var(--card)"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      onMouseEnter={() => setActiveStatus(key)}
                      onMouseLeave={() => setActiveStatus(null)}
                    >
                      <title>{`${STATUS_LABELS[key]}: ${counts[key]} (${pct(counts[key], counts.total)}%)`}</title>
                    </path>
                  ),
                )
              )}
            </svg>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {STATUS_ROWS.map(({ key, label, description, action }) => {
              const count = counts[key];
              const urgent = action && count > 0;
              return (
                <Link
                  key={key}
                  href={`/admin/applications?status=${key}`}
                  className={`ax-row ${urgent ? "ax-row-urgent" : ""}`}
                  aria-label={`${label}: ${count} records, ${pct(count, counts.total)} percent. ${urgent ? "Action needed." : description}`}
                  onMouseEnter={() => setActiveStatus(key)}
                  onMouseLeave={() => setActiveStatus(null)}
                  onFocus={() => setActiveStatus(key)}
                  onBlur={() => setActiveStatus(null)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0" aria-hidden>
                    <rect x="1" y="1" width="14" height="14" rx="4" style={{ fill: `var(--st-${key})` }} />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{label}</span>
                    <span className="text-muted block text-[11px]">{description}</span>
                  </span>
                  {urgent && (
                    <span className="ax-badge-action">
                      <TriangleAlert className="h-3 w-3" aria-hidden /> Action needed
                    </span>
                  )}
                  <span className="w-10 text-right text-lg font-extrabold tabular-nums">{count}</span>
                  <span className="text-muted w-11 text-right text-xs font-semibold tabular-nums">{pct(count, counts.total)}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: "var(--line)" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Applications received in {year}</h3>
            <p className="text-muted mt-1 text-xs">
              Monthly submissions coloured by current status (same colours as above), with the running total for the year. Hover a month for details.
            </p>
          </div>
          <nav className="flex items-center gap-1" aria-label="Choose year">
            {year > earliestYear ? (
              <Link href={`/admin?year=${year - 1}`} className="btn btn-outline btn-sm" aria-label={`Show ${year - 1}`}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <span className="btn btn-outline btn-sm opacity-40" aria-hidden><ChevronLeft className="h-4 w-4" /></span>
            )}
            <span className="min-w-14 text-center text-sm font-bold tabular-nums">{year}</span>
            {year < currentYear ? (
              <Link href={`/admin?year=${year + 1}`} className="btn btn-outline btn-sm" aria-label={`Show ${year + 1}`}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <span className="btn btn-outline btn-sm opacity-40" aria-hidden><ChevronRight className="h-4 w-4" /></span>
            )}
          </nav>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Received this year", value: num(stats.yearTotal) },
            { label: "Monthly average", value: stats.average.toLocaleString("en-US", { maximumFractionDigits: 1 }) },
            { label: "Busiest month", value: stats.peakIndex >= 0 ? `${monthName(stats.peakIndex)} (${months[stats.peakIndex].total})` : "None" },
            { label: "Still to process", value: num(stats.outstanding) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)" }}>
              <dt className="text-muted text-[11px] font-semibold uppercase tracking-wide">{item.label}</dt>
              <dd className="text-lg font-extrabold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>

        {stats.yearTotal === 0 ? (
          <p className="text-muted py-6 text-center text-sm">No applications were submitted in {year}.</p>
        ) : (
          <>
            <div className="relative" ref={chartWrap} onMouseLeave={() => setHovered(null)}>
              <svg
                viewBox={`0 0 ${chartW} 230`}
                width={chartW}
                height={230}
                className="block h-auto w-full"
                role="img"
                aria-label={`Applications received per month in ${year}: ${months.map((m, i) => `${monthName(i)} ${m.total}`).join(", ")}. ${stats.yearTotal} in total.`}
                style={{ color: "var(--ink)" }}
              >
                <defs>
                  {months.map((m, i) => {
                    const h = Math.max(0, (m.total / stats.yearMax) * PLOT_H);
                    return (
                      <clipPath key={m.label} id={`ax-clip-${i}`}>
                        <rect x={cx(i) - barW / 2} y={BASE - h} width={barW} height={h + 6} rx={Math.min(barW / 2, 10)} />
                      </clipPath>
                    );
                  })}
                </defs>
                {[0, 0.5, 1].map((f) => {
                  const y = BASE - f * PLOT_H;
                  return (
                    <g key={f}>
                      <line x1={PAD_L - 4} y1={y} x2={chartW - PAD_R + 4} y2={y} stroke="currentColor" strokeWidth="1" opacity={f === 0 ? 0.5 : 0.15} strokeDasharray={f === 0 ? undefined : "3 4"} />
                      <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.7">{Math.round(f * stats.yearMax)}</text>
                      <text x={chartW - PAD_R + 10} y={y + 3} fontSize="9" fill="currentColor" opacity="0.7">{Math.round(f * stats.yearTotal)}</text>
                    </g>
                  );
                })}
                {months.map((m, i) => {
                  const x = cx(i) - barW / 2;
                  let top = BASE;
                  return (
                    <g key={m.label} opacity={m.future ? 0.35 : 1}>
                      {hovered === i && (
                        <rect x={cx(i) - colW / 2 + 2} y="8" width={colW - 4} height={BASE - 8 + 28} rx="10" fill="currentColor" opacity="0.07" />
                      )}
                      {m.total === 0 && !m.future && (
                        <rect x={x} y={BASE - 3} width={barW} height="3" rx="1.5" fill="currentColor" opacity="0.25" />
                      )}
                      <g clipPath={`url(#ax-clip-${i})`}>
                        {STACK_ORDER.map((key) => {
                          const h = (m.byStatus[key] / stats.yearMax) * PLOT_H;
                          if (h <= 0) return null;
                          top -= h;
                          return (
                            <rect
                              key={key}
                              x={x}
                              y={top}
                              width={barW}
                              height={h}
                              style={{ fill: `var(--st-${key})`, opacity: dim(key), transition: "opacity .15s" }}
                            />
                          );
                        })}
                      </g>
                      {m.total > 0 && (
                        <text x={cx(i)} y={top - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">{m.total}</text>
                      )}
                      <text x={cx(i)} y="208" textAnchor="middle" fontSize="10" fill="currentColor" opacity={hovered === i ? 1 : 0.8} fontWeight={hovered === i ? 700 : 400}>{monthTick(i)}</text>
                    </g>
                  );
                })}
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                  d={(() => {
                    const pts = months
                      .map((m, i) => (m.future ? null : ([cx(i), BASE - (stats.cumulative[i] / stats.yearTotal) * PLOT_H] as const)))
                      .filter((p): p is readonly [number, number] => p !== null);
                    return pts
                      .map((p, i) => {
                        if (i === 0) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
                        const q = pts[i - 1];
                        const mid = (p[0] + q[0]) / 2;
                        return `C${mid.toFixed(1)} ${q[1].toFixed(1)} ${mid.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
                      })
                      .join(" ");
                  })()}
                />
                {months.map((m, i) =>
                  m.future ? null : (
                    <circle
                      key={m.label}
                      cx={cx(i)}
                      cy={BASE - (stats.cumulative[i] / stats.yearTotal) * PLOT_H}
                      r={hovered === i ? 4.5 : 3}
                      fill="var(--card)"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
                  ),
                )}
                {months.map((m, i) => (
                  <rect
                    key={`hit-${m.label}`}
                    x={cx(i) - colW / 2}
                    y="0"
                    width={colW}
                    height="215"
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${monthName(i)} ${year}: ${m.total} received`}
                    style={{ cursor: "pointer", outline: "none" }}
                    onMouseEnter={() => setHovered(i)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                  />
                ))}
              </svg>

              {hoveredMonth && hovered !== null && (
                <div className="ax-tooltip" style={{ left: `${tooltipLeft}%` }} role="status">
                  <p className="ax-tooltip-title">
                    {monthName(hovered)} {year}
                    {hovered === stats.peakIndex && <span className="ax-peak">Busiest</span>}
                    {hoveredMonth.future && <span className="ax-peak ax-upcoming">Upcoming</span>}
                  </p>
                  <p className="ax-tooltip-total">
                    <strong>{hoveredMonth.total}</strong> received
                    <span> · {pct(hoveredMonth.total, stats.yearTotal)}% of {year}</span>
                  </p>
                  <ul>
                    {TABLE_ORDER.map((key) => (
                      <li key={key}>
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--st-${key})` }} aria-hidden />
                        <span className="flex-1">{STATUS_LABELS[key]}</span>
                        <strong className="tabular-nums">{hoveredMonth.byStatus[key]}</strong>
                      </li>
                    ))}
                  </ul>
                  {!hoveredMonth.future && (
                    <p className="ax-tooltip-run">Running total: <strong>{stats.cumulative[hovered]}</strong></p>
                  )}
                </div>
              )}
            </div>
            <p className="text-muted mb-1 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <svg width="20" height="8" aria-hidden><line x1="0" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Running total (right scale)
              </span>
              <span>{stats.claimed} of {stats.yearTotal} applications from {year} have been claimed.</span>
            </p>

            <details className="ax-details mt-3">
              <summary>
                <span>View as table</span>
                <span className="text-muted text-[11px] font-normal">Month-by-month breakdown with share and running total</span>
              </summary>
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn btn-outline btn-sm" onClick={downloadCsv}>
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download CSV
                </button>
              </div>
              <div className="table-scroll mt-2">
                <table className="tbl ax-table">
                  <caption className="sr-only">Applications received per month in {year}, by current status</caption>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col" className="!text-right">Received</th>
                      <th scope="col">Share of year</th>
                      {TABLE_ORDER.map((key) => (
                        <th key={key} scope="col" className="!text-right">
                          <span className="ax-th-swatch" style={{ background: `var(--st-${key})` }} aria-hidden />
                          {STATUS_LABELS[key]}
                        </th>
                      ))}
                      <th scope="col" className="!text-right">Running total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m, i) => (
                      <tr key={m.label} className={m.future ? "ax-future" : hovered === i ? "ax-hot" : ""}>
                        <th scope="row">
                          {monthName(i)} {year}
                          {i === stats.peakIndex && <span className="ax-peak">Busiest</span>}
                        </th>
                        <td className="!text-right font-bold tabular-nums">{m.future ? "—" : m.total}</td>
                        <td>
                          {m.future ? "—" : (
                            <span className="ax-share">
                              <span className="ax-share-track"><span style={{ width: `${pct(m.total, stats.yearTotal)}%` }} /></span>
                              <span className="tabular-nums">{pct(m.total, stats.yearTotal)}%</span>
                            </span>
                          )}
                        </td>
                        {TABLE_ORDER.map((key) => (
                          <td key={key} className={`!text-right tabular-nums ${m.byStatus[key] === 0 ? "text-muted" : ""}`}>
                            {m.future ? "—" : m.byStatus[key]}
                          </td>
                        ))}
                        <td className="!text-right tabular-nums">{m.future ? "—" : stats.cumulative[i]}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total {year}</th>
                      <td className="!text-right tabular-nums">{stats.yearTotal}</td>
                      <td>100%</td>
                      {TABLE_ORDER.map((key) => (
                        <td key={key} className="!text-right tabular-nums">{stats.byStatus[key]}</td>
                      ))}
                      <td className="!text-right tabular-nums">{stats.yearTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
