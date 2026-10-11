"use client";

import {
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import { ListCard, ListLink, Pager } from "@/components/list-card";
import { renderQrPoster } from "@/lib/qr-poster";
import SelectField from "@/components/select-field";

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
  total,
  school,
}: {
  tokens: TokenRow[];
  csrfToken: string;
  dateOrder: "newest" | "oldest";
  page: number;
  totalPages: number;
  total: number;
  school: { name: string; address: string; motto: string };
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
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

  // Render QR assets client-side from the authenticated access-link response.
  useEffect(() => {
    if (!issued) return;
    let cancelled = false;
    (async () => {
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
      const poster = await renderQrPoster({
        url: issued.url,
        label: issued.label,
        expiresAt: issued.expiresAt,
        schoolName: school.name,
        address: school.address,
        motto: school.motto,
      }).catch(() => "");
      if (!cancelled) {
        setPngDataUrl(png);
        setSvgMarkup(svg);
        setPosterDataUrl(poster);
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
        setLabel("");
        setExpiresAt("");
        router.refresh();
        return;
      }
      setError(data?.error || "Token creation failed.");
    } catch {
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
      setError(data?.error || "Regeneration failed.");
    } catch {
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
        setError(data?.error || "The access link could not be recovered.");
      }
    } catch {
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
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <QrCode className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
            New Access Token
          </h2>
          {error && (
            <div className="mb-3 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} role="alert">
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
                placeholder="e.g. SY 2026-2027"
                maxLength={120}
              />
            </div>
            <div className="mb-4">
              <label className="lbl" htmlFor="qr_exp">
                Expiration <span className="normal-case">(required)</span>
              </label>
              <input
                id="qr_exp"
                type="datetime-local"
                className="inp"
                required
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
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
        {issued && (
          <section className="card p-5" style={{ borderColor: "var(--accent-gold)" }}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <ShieldAlert className="h-4 w-4" style={{ color: "var(--accent-gold)" }} aria-hidden />
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
      <ListCard className="card h-fit lg:col-span-9">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-sm font-bold">Token Registry</h2>
          <ListLink
            href={`/admin/qr?dateOrder=${dateOrder === "newest" ? "oldest" : "newest"}`}
            className="text-xs font-semibold no-underline"
            style={{ color: "var(--academic-blue)" }}
          >
            {dateOrder === "newest" ? "↓ Newest first" : "↑ Oldest first"}
          </ListLink>
        </div>
        {tokens.length === 0 ? (
          <p className="text-muted px-4 py-8 text-center text-sm">
            No access tokens yet. Generate one to open the public application form.
          </p>
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
                  return (
                    <tr key={t.id}>
                      <td className="qr-token-label" data-label="Label">
                        <p className="text-xs font-bold">{t.label}</p>
                        <p className="text-muted text-[10.5px]">
                          #{t.id}
                        </p>
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${s.cls}`}>{s.key}</span>
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
          summary={total === 0 ? "No records" : `Showing ${(page - 1) * ADMIN_PAGE_SIZE + 1}–${Math.min(total, page * ADMIN_PAGE_SIZE)} of ${total} · ${ADMIN_PAGE_SIZE} per page`}
        />
        <p className="text-muted border-t px-4 py-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--line)" }}>
          A QR token is a bearer credential: anyone holding a valid, unexpired,
          unrevoked token can open the application form. Tokens grant access to the
          form only — never to submitted records — and contain no student data. Previously created tokens that cannot be recovered must be regenerated before they can be viewed or shared.
        </p>
      </ListCard>
    </div>
  );
}
