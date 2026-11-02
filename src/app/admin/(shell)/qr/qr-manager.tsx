"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileCode2,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  QrCode,
  RefreshCcw,
  ShieldAlert,
  TriangleAlert,
  Wifi,
  Wrench,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import { ListCard, ListLink, Pager } from "@/components/list-card";
import { renderQrPoster } from "@/lib/qr-poster";
import SelectField from "@/components/select-field";
import DateTimePicker from "@/components/date-time-picker";
import SortIcon from "@/components/sort-icon";
import type { TokenHealth } from "@/lib/token-health-types";

const HEALTH_COLOR = { healthy: "var(--success)", warning: "var(--st-pending)", error: "var(--danger)" } as const;

type TaskKind = "view" | "create" | "regenerate";

const TASK_COPY: Record<TaskKind, { title: string; steps: string[] }> = {
  view: {
    title: "Opening the active QR link",
    steps: ["Confirming your administrator session", "Retrieving the secure application link", "Generating the QR code", "Preparing the poster and download files"],
  },
  create: {
    title: "Creating a new application QR",
    steps: ["Validating the label and expiry date", "Creating the secure application link", "Generating the QR code", "Preparing the poster and download files"],
  },
  regenerate: {
    title: "Renewing the application link",
    steps: ["Deactivating the previous link", "Creating a replacement link", "Generating the QR code", "Preparing the poster and download files"],
  },
};

function TaskProgress({ kind, stage }: { kind: TaskKind; stage: number }) {
  const { title, steps } = TASK_COPY[kind];
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <section className="card p-5" role="status" aria-live="polite" aria-busy="true">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--academic-blue)]" aria-hidden /> {title}
      </h2>
      <p className="text-muted mt-1 text-xs">Please keep this page open. This normally takes only a few seconds.</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
        <div className="h-full rounded-full bg-[var(--academic-blue)] transition-[width] duration-500" style={{ width: `${Math.min(100, ((stage + 0.5) / steps.length) * 100)}%` }} />
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => {
          const done = i < stage;
          const current = i === stage;
          return (
            <li key={step} className={`flex items-center gap-2.5 text-xs ${done || current ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-[var(--success)] text-white" : current ? "bg-[var(--academic-blue)]/15 text-[var(--academic-blue)]" : "bg-[var(--line)]"}`}
              >
                {done ? <Check className="h-3 w-3" aria-hidden /> : current ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : i + 1}
              </span>
              <span className={current ? "font-semibold" : ""}>{step}</span>
            </li>
          );
        })}
      </ol>
      {slow && (
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--muted)]">
          This is taking longer than usual, which can happen on a slow connection. Nothing is wrong — the QR code will appear as soon as it is ready.
        </p>
      )}
    </section>
  );
}

type TokenRow = {
  id: number;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
};

function statusOf(t: TokenRow): { key: string; cls: string } {
  if (t.revokedAt) return { key: "Revoked", cls: "badge-inactive" };
  if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now())
    return { key: "Expired", cls: "badge-expired" };
  return { key: "Active", cls: "badge-active" };
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTokenDate(value: string): { date: string; time: string } {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function QrManager({
  tokens,
  csrfToken,
  dateOrder,
  page,
  totalPages,
  schoolYears,
  school,
}: {
  tokens: TokenRow[];
  csrfToken: string;
  dateOrder: "newest" | "oldest";
  page: number;
  totalPages: number;
  schoolYears: string[];
  school: { name: string; address: string; motto: string };
}) {
  const router = useRouter();
  const [label, setLabel] = useState(schoolYears[0] ?? "");
  const [expiresAt, setExpiresAt] = useState("");
  const [task, setTask] = useState<{ kind: TaskKind; stage: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ id: number; url: string; label: string; expiresAt: string | null; recovered?: boolean } | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState("");
  const [posterDataUrl, setPosterDataUrl] = useState("");
  const [svgMarkup, setSvgMarkup] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const requestInFlight = useRef(false);
  const [health, setHealth] = useState<Record<number, TokenHealth>>({});
  const [rechecking, setRechecking] = useState<number | null>(null);
  const [openHealth, setOpenHealth] = useState<number | null>(null);
  const activeKey = tokens
    .filter((token) => !token.revokedAt)
    .map((token) => token.id)
    .join(",");

  const runHealth = useCallback(async (ids: string, fresh: boolean) => {
    if (!ids) return;
    try {
      const response = await fetch(`/api/admin/tokens/health?ids=${ids}${fresh ? "&fresh=1" : ""}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; results?: TokenHealth[] } | null;
      if (!response.ok || !data?.ok || !data.results) return;
      const results = data.results;
      setHealth((current) => {
        const next = { ...current };
        for (const result of results) next[result.id] = result;
        return next;
      });
    } catch {
      // A failed check keeps the previous result; the next scheduled check tries again.
    }
  }, []);

  // Checks run on load and every minute while the tab is visible, so a link that silently stops working shows up quickly.
  useEffect(() => {
    if (!activeKey) return;
    const first = window.setTimeout(() => void runHealth(activeKey, false), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void runHealth(activeKey, false);
    }, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [activeKey, runHealth]);

  async function recheck(id: number) {
    setRechecking(id);
    await runHealth(String(id), true);
    setRechecking(null);
  }

  function fixToken(id: number, fix: "regenerate" | "recheck") {
    if (fix === "recheck") {
      void recheck(id);
      return;
    }
    if (!window.confirm("Replace this link with a new working one? The current link, and any QR code printed from it, will stop working.")) return;
    void regenerate(id);
  }

  // Render QR assets client-side from the authenticated access-link response.
  useEffect(() => {
    if (!issued) return;
    let cancelled = false;
    (async () => {
      setTask((t) => (t ? { ...t, stage: 2 } : t));
      try {
        const png = await QRCode.toDataURL(issued.url, {
          width: 1024,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        const svg = await QRCode.toString(issued.url, {
          type: "svg",
          width: 1024,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) {
          setPngDataUrl(png);
          setSvgMarkup(svg);
          setTask((t) => (t ? { ...t, stage: 3 } : t));
        }
        const poster = await renderQrPoster({
          url: issued.url,
          label: issued.label,
          expiresAt: issued.expiresAt,
          schoolName: school.name,
          address: school.address,
          motto: school.motto,
        }).catch(() => "");
        if (!cancelled) setPosterDataUrl(poster);
      } catch {
        if (!cancelled) setError("The QR code could not be generated. Please try again.");
      } finally {
        if (!cancelled) setTask(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issued, school]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || requestInFlight.current) return;
    if (!expiresAt) {
      setError("Choose when this QR code should expire.");
      return;
    }
    requestInFlight.current = true;
    setBusy("create");
    setTask({ kind: "create", stage: 1 });
    setError("");
    setIssued(null);
    setPngDataUrl("");
    setPosterDataUrl("");
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          label,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: number; url?: string; label?: string; expiresAt?: string; error?: string }
        | null;
      if (res.status === 201 && data?.ok && data.url && data.id) {
        setIssued({ id: data.id, url: data.url, label: data.label ?? label, expiresAt: data.expiresAt ?? null });
        setLabel(schoolYears[0] ?? "");
        setExpiresAt("");
        router.refresh();
        return;
      }
      setTask(null);
      setError(data?.error || "Token creation failed.");
    } catch {
      setTask(null);
      setError("Network error. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  async function revoke(id: number) {
    if (!window.confirm("Revoke this application link now? Anyone using it will lose access to the application form.")) return;
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(`revoke-${id}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/tokens/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ revoke: true }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        router.refresh();
      } else {
        setError(data?.error || "Revocation failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  async function regenerate(id: number) {
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(`regen-${id}`);
    setTask({ kind: "regenerate", stage: 1 });
    setError("");
    setIssued(null);
    setPngDataUrl("");
    setPosterDataUrl("");
    try {
      const res = await fetch(`/api/admin/tokens/${id}/regenerate`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: number; url?: string; label?: string; expiresAt?: string; error?: string }
        | null;
      if (res.status === 201 && data?.ok && data.url && data.id) {
        setIssued({ id: data.id, url: data.url, label: data.label ?? "", expiresAt: data.expiresAt ?? null });
        router.refresh();
        return;
      }
      setTask(null);
      setError(data?.error || "Regeneration failed.");
    } catch {
      setTask(null);
      setError("Network error. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  async function reveal(id: number) {
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(`view-${id}`);
    setTask({ kind: "view", stage: 1 });
    setError("");
    setIssued(null);
    setPngDataUrl("");
    setPosterDataUrl("");
    try {
      const response = await fetch(`/api/admin/tokens/${id}/reveal`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; label?: string; expiresAt?: string | null; error?: string } | null;
      if (response.ok && data?.ok && data.url) {
        setIssued({ id, url: data.url, label: data.label ?? "", expiresAt: data.expiresAt ?? null, recovered: true });
      } else {
        setTask(null);
        setError(data?.error || "The access link could not be recovered.");
      }
    } catch {
      setTask(null);
      setError("Connection problem while loading the access link. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  function runSelectedAction(id: number, action: "view" | "revoke" | "regenerate") {
    if (action === "view") void reveal(id);
    else if (action === "revoke") void revoke(id);
    else void regenerate(id);
  }

  const downloadSvg = () => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sjaa-application-qr-${issued?.id}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyUrl = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="flex flex-col gap-5 lg:col-span-3">
        {/* Create form */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
              <QrCode className="h-3.5 w-3.5" aria-hidden />
            </span>
            New Access Token
          </h2>
          {error && (
            <div className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-xs text-[var(--ink)]" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={create}>
            <div className="mb-4">
              <label className="lbl" htmlFor="qr_label">
                Label / Campaign
              </label>
              <input
                id="qr_label"
                className="inp"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`e.g. ${schoolYears[0] ?? "SY 2026-2027"}`}
                maxLength={120}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-muted text-[11px]">Suggestions:</span>
                {schoolYears.map((sy) => (
                  <button
                    key={sy}
                    type="button"
                    onClick={() => setLabel(sy)}
                    aria-pressed={label === sy}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${label === sy ? "border-[var(--academic-blue)] bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]" : "border-[var(--line)] bg-[var(--elevated)] text-[var(--ink)] hover:border-[var(--academic-blue)]"}`}
                  >
                    {sy}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="lbl" htmlFor="qr_exp">
                Expiration <span className="normal-case">(required)</span>
              </label>
              <DateTimePicker
                id="qr_exp"
                mode="datetime"
                required
                value={expiresAt}
                onValueChange={setExpiresAt}
                min={todayIso()}
                placeholder="Choose expiry date and time"
                presets={[
                  { label: "+7 days", offsetDays: 7 },
                  { label: "+30 days", offsetDays: 30 },
                  { label: "+90 days", offsetDays: 90 },
                ]}
              />
              <p className="text-muted mt-1 text-[11px]">Students can no longer use the QR code after this date and time.</p>
            </div>
            <button type="submit" className="btn btn-gold w-full" disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <QrCode className="h-4 w-4" aria-hidden />}
              Generate Application QR
            </button>
          </form>
        </section>

        {/* Authenticated token link and QR display */}
        {task && <TaskProgress kind={task.kind} stage={task.stage} />}
        {!task && issued && (
          <section className="card p-5" style={{ borderColor: "var(--accent-gold)" }}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent-gold)]/16 text-[var(--accent-gold)]">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              </span>
              {issued.recovered ? "Active QR Link" : "New QR Issued"}
            </h2>
            <p className="text-muted mb-4 text-xs leading-relaxed">
              The access link is encrypted in the database and can be reopened while active.
              Share it only through approved school channels (campus posters or official group chats).
            </p>
            <div className="mb-4 rounded-md border bg-white p-3" style={{ borderColor: "var(--line)" }}>
              {pngDataUrl ? (
                <button
                  type="button"
                  className="group relative block w-full cursor-zoom-in"
                  onClick={() => setZoomed(true)}
                  aria-label="Enlarge QR code"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pngDataUrl} alt="Application form QR code" className="aspect-square w-full" />
                  <span className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Maximize2 className="h-3 w-3" aria-hidden /> Enlarge
                  </span>
                </button>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
                </div>
              )}
            </div>
            <div className="mb-3 flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-[10.5px]"
                style={{ borderColor: "var(--line)", background: "var(--bg)" }}
              >
                {issued.url}
              </code>
              <button type="button" className="btn btn-outline btn-sm" onClick={copyUrl}>
                <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {/^https?:\/\/(localhost|127\.)/.test(issued.url) && (
              <p className="mb-3 rounded-md border px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--accent-gold)", background: "var(--bg)" }}>
                <strong>This link only works on this computer.</strong> To let phones on any network open it, run{" "}
                <code>npm run share</code> in a terminal, then generate or reopen the QR code.
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              onClick={() => setDownloadOpen((open) => !open)}
              aria-expanded={downloadOpen}
              disabled={!pngDataUrl}
            >
              <Download className="h-4 w-4" aria-hidden /> Download
              <ChevronDown className={`h-4 w-4 transition-transform ${downloadOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            <div className="dl-collapse" data-open={downloadOpen} inert={!downloadOpen}>
              <div className="dl-collapse-inner">
              <div className="mt-2 flex flex-col gap-1.5 rounded-md border p-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                {posterDataUrl && (
                  <a href={posterDataUrl} download={`sjaa-application-poster-${issued.id}.png`} className="dl-option">
                    <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      Poster (PNG)
                      <span className="text-muted block text-[10.5px] font-normal">A4, with steps and expiry date</span>
                    </span>
                  </a>
                )}
                {pngDataUrl && (
                  <a href={pngDataUrl} download={`sjaa-application-qr-${issued.id}.png`} className="dl-option">
                    <QrCode className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      QR code only (PNG)
                      <span className="text-muted block text-[10.5px] font-normal">Plain image for slides or chats</span>
                    </span>
                  </a>
                )}
                {svgMarkup && (
                  <button type="button" className="dl-option" onClick={downloadSvg}>
                    <FileCode2 className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      QR code (SVG)
                      <span className="text-muted block text-[10.5px] font-normal">Scalable, for professional printing</span>
                    </span>
                  </button>
                )}
              </div>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => { setIssued(null); setDownloadOpen(false); }}>
              Close this panel
            </button>
          </section>
        )}
      </div>
      {zoomed && issued && pngDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged QR code"
          onClick={() => setZoomed(false)}
        >
          <div className="max-h-full rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pngDataUrl} alt="Application form QR code" className="aspect-square w-[min(80vw,80vh,560px)]" />
            <button type="button" className="btn btn-outline btn-sm mt-3 w-full" onClick={() => setZoomed(false)} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Token registry */}
      <ListCard className="card h-fit overflow-hidden border border-[var(--line)] bg-[var(--elevated)] shadow-sm lg:col-span-9">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            </span>
            Token Registry
          </h2>
          <ListLink
            href={`/admin/qr?dateOrder=${dateOrder === "newest" ? "oldest" : "newest"}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--elevated)] px-3 py-1 text-xs font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--academic-blue)]"
          >
            {dateOrder === "newest" ? "Newest first" : "Oldest first"}
            <SortIcon active dir={dateOrder === "newest" ? "desc" : "asc"} />
          </ListLink>
        </div>
        {tokens.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--line)] text-muted">
              <QrCode className="h-7 w-7" aria-hidden />
            </div>
            <p className="font-bold text-base text-[var(--ink)]">No access tokens yet</p>
            <p className="text-muted mt-1 text-xs max-w-sm mx-auto">
              Generate one to open the public application form and share it as a QR code.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="tbl qr-token-table">
              <colgroup>
                <col className="qr-col-label" />
                <col className="qr-col-status" />
                <col className="qr-col-expires" />
                <col className="qr-col-uses" />
                <col className="qr-col-created" />
                <col className="qr-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="qr-token-label">Label</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Uses</th>
                  <th>Created</th>
                  <th className="qr-token-manage">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const s = statusOf(t);
                  const h = s.key === "Active" ? health[t.id] : undefined;
                  const showDetail = Boolean(h && (h.level !== "healthy" || openHealth === t.id));
                  return (
                    <Fragment key={t.id}>
                    <tr className={showDetail ? "has-health" : undefined}>
                      <td className="qr-token-label" data-label="Label">
                        <p className="text-xs font-bold">{t.label}</p>
                        <p className="text-muted text-[10.5px]">
                          #{t.id}
                        </p>
                      </td>
                      <td data-label="Status">
                        {s.key === "Active" ? (
                          <button
                            type="button"
                            className="qr-status"
                            data-level={h?.level ?? "checking"}
                            onClick={() => setOpenHealth((current) => (current === t.id ? null : t.id))}
                            aria-expanded={showDetail}
                            aria-label={`Link status for ${t.label}`}
                            title={h ? `Checked ${new Date(h.checkedAt).toLocaleTimeString("en-PH")}` : "Checking link"}
                          >
                            {rechecking === t.id || !h ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : (
                              <span className="qr-status-dot" aria-hidden />
                            )}
                            <span>{!h ? "Checking" : h.level === "healthy" ? "Live" : h.level === "warning" ? "Attention" : "Offline"}</span>
                          </button>
                        ) : (
                          <span className={`badge ${s.cls}`}>{s.key}</span>
                        )}
                      </td>
                      <td className="text-muted whitespace-nowrap text-xs" data-label="Expires">
                        {t.expiresAt ? (
                          <>
                            <span className="block">{formatTokenDate(t.expiresAt).date}</span>
                            <span className="text-[10px]">{formatTokenDate(t.expiresAt).time}</span>
                          </>
                        ) : "Never"}
                      </td>
                      <td className="text-center text-xs font-semibold tabular-nums" data-label="Uses">{t.useCount}</td>
                      <td className="text-muted text-xs" data-label="Created">
                        <span className="block">{formatTokenDate(t.createdAt).date}</span>
                        <span className="text-[10px]">{formatTokenDate(t.createdAt).time}</span>
                      </td>
                      <td className="qr-token-manage" data-label="Actions">
                        {s.key === "Active" ? (
                          <SelectField
                            className="qr-action-select inp w-full !min-w-0 !px-2 !py-1.5 text-xs"
                            aria-label={`Actions for ${t.label}`}
                            value=""
                            disabled={Boolean(busy)}
                            onChange={(event) => {
                              const action = event.target.value;
                              if (action === "view" || action === "revoke" || action === "regenerate") {
                                runSelectedAction(t.id, action);
                              }
                            }}
                          >
                            <option value="" disabled>Choose action…</option>
                            <option value="view">View / share link</option>
                            <option value="revoke">Revoke link</option>
                            <option value="regenerate">Regenerate link</option>
                          </SelectField>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm whitespace-nowrap"
                            onClick={() => runSelectedAction(t.id, "regenerate")}
                            disabled={Boolean(busy)}
                          >
                            {busy === `regen-${t.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCcw className="h-3.5 w-3.5" aria-hidden />}
                            Regenerate
                          </button>
                        )}
                      </td>
                    </tr>
                    {showDetail && h && (
                      <tr className="qr-health-row">
                        <td colSpan={6}>
                          <div
                            className="rounded-lg border px-3.5 py-3"
                            style={{
                              borderColor: `color-mix(in srgb, ${HEALTH_COLOR[h.level]} 45%, var(--line))`,
                              background: `color-mix(in srgb, ${HEALTH_COLOR[h.level]} 7%, var(--card))`,
                            }}
                            role={h.level === "error" ? "alert" : "status"}
                          >
                            {h.issues.length === 0 ? (
                              <p className="flex items-center gap-2 text-xs font-semibold" style={{ color: HEALTH_COLOR.healthy }}>
                                <CheckCircle2 className="h-4 w-4" aria-hidden /> Working. Students can open this link and reach the form.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {h.issues.map((issue) => (
                                  <li key={issue.code} className="flex items-start gap-2 text-left">
                                    {issue.level === "error" ? (
                                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HEALTH_COLOR.error }} aria-hidden />
                                    ) : (
                                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HEALTH_COLOR.warning }} aria-hidden />
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-[var(--ink)]">{issue.title}</p>
                                      <p className="text-muted text-[11.5px] leading-relaxed">{issue.detail}</p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {h.issues.some((issue) => issue.code.startsWith("address") || issue.code === "database") && (
                              <div className="qr-connection-help mt-3 rounded-md px-3 py-2.5 text-left">
                                <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                                  <Wifi className="h-3.5 w-3.5" aria-hidden /> Try these quick checks first
                                </p>
                                <ul className="text-muted mt-1.5 list-disc space-y-0.5 pl-5 text-[11.5px] leading-relaxed">
                                  <li>Confirm this computer&apos;s Wi-Fi or network has working internet (open any website).</li>
                                  <li>Turn the Wi-Fi off and on again, or reconnect to the network, then press <strong>Recheck now</strong>.</li>
                                  <li>Make sure the app is still running with <code>npm run dev</code>; restarting it refreshes the public link connection.</li>
                                  <li>If it still fails, use <strong>Fix: issue a new link</strong> when offered.</li>
                                </ul>
                              </div>
                            )}
                            {h.fix && (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className={h.fix === "regenerate" ? "btn btn-gold btn-sm" : "btn btn-outline btn-sm"}
                                  onClick={() => fixToken(t.id, h.fix!)}
                                  disabled={Boolean(busy) || rechecking === t.id}
                                >
                                  {rechecking === t.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : h.fix === "regenerate" ? (
                                    <Wrench className="h-3.5 w-3.5" aria-hidden />
                                  ) : (
                                    <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                  {h.fix === "regenerate" ? "Fix: issue a new link" : "Recheck now"}
                                </button>
                                <span className="text-muted text-[11px]">
                                  {h.fix === "regenerate"
                                    ? "Creates a working replacement with the same label and expiry."
                                    : "Use this after the connection or tunnel is running again."}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          basePath="/admin/qr"
          params={{ dateOrder }}
          page={page}
          totalPages={totalPages}
          summary={`${ADMIN_PAGE_SIZE} per page`}
        />
        <p className="text-muted border-t border-[var(--line)] bg-[var(--card)]/40 px-5 py-3 text-[11px] leading-relaxed">
          A QR token is a bearer credential: anyone holding a valid, unexpired,
          unrevoked token can open the application form. Tokens grant access to the
          form only — never to submitted records — and contain no student data. Previously created tokens that cannot be recovered must be regenerated before they can be viewed or shared.
        </p>
      </ListCard>
    </div>
  );
}
