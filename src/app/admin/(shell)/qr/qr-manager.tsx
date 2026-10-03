"use client";

import {
  Copy,
  Download,
  Loader2,
  Plus,
  QrCode,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";

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

export default function QrManager({
  tokens,
  csrfToken,
  dateOrder,
  page,
  totalPages,
  total,
}: {
  tokens: TokenRow[];
  csrfToken: string;
  dateOrder: "newest" | "oldest";
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ id: number; url: string; recovered?: boolean } | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState("");
  const [svgMarkup, setSvgMarkup] = useState("");
  const [copied, setCopied] = useState(false);
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
      if (!cancelled) {
        setPngDataUrl(png);
        setSvgMarkup(svg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issued]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy("create");
    setError("");
    setIssued(null);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          label,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: number; url?: string; error?: string }
        | null;
      if (res.status === 201 && data?.ok && data.url && data.id) {
        setIssued({ id: data.id, url: data.url });
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
    try {
      const res = await fetch(`/api/admin/tokens/${id}/regenerate`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: number; url?: string; error?: string }
        | null;
      if (res.status === 201 && data?.ok && data.url && data.id) {
        setIssued({ id: data.id, url: data.url });
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
    try {
      const response = await fetch(`/api/admin/tokens/${id}/reveal`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (response.ok && data?.ok && data.url) {
        setIssued({ id, url: data.url, recovered: true });
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
      <div className="flex flex-col gap-5 lg:col-span-4">
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
                Expiration <span className="normal-case">(optional — defaults per server config)</span>
              </label>
              <input
                id="qr_exp"
                type="datetime-local"
                className="inp"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-gold w-full" disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              Generate Token &amp; QR
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
            <div className="mb-4 flex justify-center rounded-md border bg-white p-4" style={{ borderColor: "var(--line)" }}>
              {pngDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pngDataUrl} alt="Application form QR code" className="h-44 w-44" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
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
            <div className="flex gap-2">
              {pngDataUrl && (
                <a href={pngDataUrl} download={`sjaa-application-qr-${issued.id}.png`} className="btn btn-primary btn-sm flex-1">
                  <Download className="h-4 w-4" aria-hidden /> PNG (1024px)
                </a>
              )}
              {svgMarkup && (
                <button type="button" className="btn btn-outline btn-sm flex-1" onClick={downloadSvg}>
                  <Download className="h-4 w-4" aria-hidden /> SVG
                </button>
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => setIssued(null)}>
              Close this panel
            </button>
          </section>
        )}
      </div>

      {/* Token registry */}
      <section className="card h-fit lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-sm font-bold">Token Registry</h2>
          <Link
            href={`/admin/qr?dateOrder=${dateOrder === "newest" ? "oldest" : "newest"}`}
            className="text-xs font-semibold no-underline"
            style={{ color: "var(--academic-blue)" }}
          >
            {dateOrder === "newest" ? "↓ Newest first" : "↑ Oldest first"}
          </Link>
        </div>
        {tokens.length === 0 ? (
          <p className="text-muted px-4 py-8 text-center text-sm">
            No access tokens yet. Generate one to open the public application form.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                      <td className="qr-token-label">
                        <p className="text-xs font-bold">{t.label}</p>
                        <p className="text-muted text-[10.5px]">
                          #{t.id}
                        </p>
                      </td>
                      <td>
                        <span className={`badge ${s.cls}`}>{s.key}</span>
                      </td>
                      <td className="text-muted whitespace-nowrap text-xs">
                        {t.expiresAt
                          ? new Date(t.expiresAt).toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Never"}
                      </td>
                      <td className="text-center text-xs font-semibold tabular-nums">{t.useCount}</td>
                      <td className="text-muted whitespace-nowrap text-xs">{new Date(t.createdAt).toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="qr-token-manage">
                        {s.key === "Active" ? (
                          <select
                            className="inp !w-[154px] !min-w-[154px] !px-2 !py-1.5 text-xs"
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
                          </select>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <span className="text-muted text-xs">
            {total === 0 ? "No records" : `Showing ${(page - 1) * ADMIN_PAGE_SIZE + 1}–${Math.min(total, page * ADMIN_PAGE_SIZE)} of ${total}`} · Page {page} of {totalPages} · {ADMIN_PAGE_SIZE} per page
          </span>
          <div className="flex gap-2">
            <Link
              className={`btn btn-outline btn-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
              href={`/admin/qr?page=${page - 1}&dateOrder=${dateOrder}`}
              aria-disabled={page <= 1}
            >
              Prev
            </Link>
            <Link
              className={`btn btn-outline btn-sm ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              href={`/admin/qr?page=${page + 1}&dateOrder=${dateOrder}`}
              aria-disabled={page >= totalPages}
            >
              Next
            </Link>
          </div>
        </div>
        <p className="text-muted border-t px-4 py-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--line)" }}>
          A QR token is a bearer credential: anyone holding a valid, unexpired,
          unrevoked token can open the application form. Tokens grant access to the
          form only — never to submitted records — and contain no student data. Previously created tokens that cannot be recovered must be regenerated before they can be viewed or shared.
        </p>
      </section>
    </div>
  );
}
