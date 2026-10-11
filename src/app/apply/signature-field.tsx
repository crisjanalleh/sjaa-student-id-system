"use client";

import {
  CheckCircle2,
  Eraser,
  ImageUp,
  Lightbulb,
  PenLine,
  RotateCw,
  Save,
  Smartphone,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";

// The ID signature box is 3:1. Every signature is trimmed and fitted into this frame,
// so it lands on the ID the same way whether it was drawn or uploaded.
const OUT_W = 900;
const OUT_H = 300;
const OUT_PAD = 24;
const MAX_SCALE = 3;
const INK = { r: 16, g: 47, b: 86 };
const MAX_UPLOAD_MB = 5;

type Point = { x: number; y: number };

function trimAndFit(source: HTMLCanvasElement): string | null {
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW < 12 || boxH < 6) return null;
  const scale = Math.min((OUT_W - 2 * OUT_PAD) / boxW, (OUT_H - 2 * OUT_PAD) / boxH, MAX_SCALE);
  const out = document.createElement("canvas");
  out.width = OUT_W;
  out.height = OUT_H;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  outCtx.imageSmoothingQuality = "high";
  const drawW = boxW * scale;
  const drawH = boxH * scale;
  outCtx.drawImage(source, minX, minY, boxW, boxH, (OUT_W - drawW) / 2, (OUT_H - drawH) / 2, drawW, drawH);
  return out.toDataURL("image/png");
}

async function signatureFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    // Paper white becomes transparent; dark ink is recoloured to the ID's navy ink.
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const ink = Math.max(0, Math.min(1, (235 - lum) / 110));
      d[i] = INK.r;
      d[i + 1] = INK.g;
      d[i + 2] = INK.b;
      d[i + 3] = Math.round(d[i + 3] * ink);
    }
    ctx.putImageData(image, 0, 0);
    return trimAndFit(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Shows the signature exactly as the ID's 3:1 signature box will frame it. */
export function IdSignaturePreview({ src, className = "" }: { src: string; className?: string }) {
  return (
    <figure className={`m-0 ${className}`}>
      <div
        className="relative w-full overflow-hidden rounded-md border"
        style={{ aspectRatio: "3 / 1", background: "#ffffff", borderColor: "var(--line-strong)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Your signature as it will appear on your ID" className="absolute inset-0 h-full w-full object-contain" />
        <span className="absolute inset-x-3 bottom-2 border-t border-slate-300" aria-hidden />
      </div>
      <figcaption className="text-muted mt-1 text-center text-[10px] font-semibold uppercase tracking-wide">
        Preview · Student signature on ID
      </figcaption>
    </figure>
  );
}

function usePortraitPhone() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(orientation: portrait) and (max-width: 820px)").matches,
    () => false,
  );
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

async function enterLandscape() {
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* unsupported (e.g. iPhone Safari): the rotate-your-phone screen covers this */
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
  } catch {
    /* orientation lock is only allowed in fullscreen on some browsers */
  }
}

function leaveLandscape() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

function SignaturePadModal({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[] | null>(null);
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const portrait = usePortraitPhone();

  function redraw() {
    const canvas = canvasRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = canvas.width / Math.max(1, holder.clientWidth);
    const unit = canvas.height / dpr; // points are stored relative to the pad height
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgb(${INK.r},${INK.g},${INK.b})`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(2.4, unit * 0.016) * dpr;
    const all = current.current ? [...strokes.current, current.current] : strokes.current;
    for (const stroke of all) {
      const pts = stroke.map((p) => ({ x: p.x * unit * dpr, y: p.y * unit * dpr }));
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  }

  function refreshPreview() {
    const canvas = canvasRef.current;
    setCount(strokes.current.length);
    setPreview(canvas && strokes.current.length ? trimAndFit(canvas) ?? "" : "");
  }

  // Keep the canvas sharp on high-density phone screens and when the device rotates.
  useEffect(() => {
    const holder = holderRef.current;
    const canvas = canvasRef.current;
    if (!holder || !canvas) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.max(1, holder.clientWidth);
      const height = Math.max(1, holder.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      redraw();
      refreshPreview();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(holder);
    return () => observer.disconnect();
  }, [portrait]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      leaveLandscape();
    };
  }, []);

  function toPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.height, y: (event.clientY - rect.top) / rect.height };
  }

  function save() {
    const canvas = canvasRef.current;
    const url = canvas && strokes.current.length ? trimAndFit(canvas) : null;
    if (!url) {
      setError("Please sign inside the box first.");
      return;
    }
    onSave(url);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Signature pad"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold">Sign your name</h2>
          <p className="text-muted truncate text-[11px]">Use your finger or a stylus. Sign big — we resize it to fit your ID.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-3 p-3">
        <div className="relative min-w-0 flex-1">
          <div
            ref={holderRef}
            className="absolute inset-0 overflow-hidden rounded-lg border-2 border-dashed"
            style={{ background: "#ffffff", borderColor: "var(--line-strong)" }}
          >
            <span className="pointer-events-none absolute inset-x-6 bottom-[28%] border-t-2 border-slate-300" aria-hidden />
            <span className="pointer-events-none absolute bottom-[28%] left-6 -translate-y-1 text-lg font-light text-slate-400" aria-hidden>
              ✕
            </span>
            {count === 0 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400">
                Sign here
              </span>
            )}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Draw your signature"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                current.current = [toPoint(event)];
                setError("");
                redraw();
              }}
              onPointerMove={(event) => {
                if (!current.current) return;
                current.current.push(toPoint(event));
                redraw();
              }}
              onPointerUp={() => {
                if (!current.current) return;
                strokes.current.push(current.current);
                current.current = null;
                redraw();
                refreshPreview();
              }}
              onPointerCancel={() => {
                current.current = null;
                redraw();
              }}
            />
          </div>
        </div>

        <aside className="flex w-[190px] shrink-0 flex-col gap-2 overflow-y-auto sm:w-[230px]">
          {preview ? (
            <IdSignaturePreview src={preview} />
          ) : (
            <div
              className="text-muted flex items-center justify-center rounded-md border border-dashed px-2 text-center text-[11px]"
              style={{ aspectRatio: "3 / 1", borderColor: "var(--line-strong)" }}
            >
              Your ID preview appears here
            </div>
          )}
          <p className="text-muted hidden items-start gap-1.5 text-[11px] leading-snug [@media(min-height:380px)]:flex">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Sign the way you usually do. Made a mistake? Tap Undo to remove the last stroke.
          </p>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={count === 0}
              onClick={() => {
                strokes.current.pop();
                redraw();
                refreshPreview();
              }}
            >
              <Undo2 className="h-4 w-4" aria-hidden /> Undo
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={count === 0}
              onClick={() => {
                strokes.current = [];
                redraw();
                refreshPreview();
              }}
            >
              <Eraser className="h-4 w-4" aria-hidden /> Clear
            </button>
            <button type="button" className="btn btn-primary col-span-2" disabled={count === 0} onClick={save}>
              <Save className="h-4 w-4" aria-hidden /> Save signature
            </button>
          </div>
        </aside>

        {portrait && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center"
            style={{ background: "var(--bg)" }}
            role="alert"
          >
            <RotateCw className="h-10 w-10 animate-pulse" style={{ color: "var(--accent-fill)" }} aria-hidden />
            <p className="text-base font-bold">Turn your phone sideways</p>
            <p className="text-muted max-w-xs text-sm">
              Signing is easier in landscape. If nothing happens, make sure your phone&apos;s rotation lock is off.
              Your signature so far is kept safe.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LandscapeIntro({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Before you sign">
      <div className="modal-panel p-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--accent-fill) 14%, var(--card))" }}>
            <Smartphone className="h-5 w-5 -rotate-90" style={{ color: "var(--accent-fill)" }} aria-hidden />
          </span>
          <h3 className="text-base font-bold">Let&apos;s get your signature</h3>
        </div>
        <p className="text-sm leading-relaxed">
          Next, the signing pad opens in <strong>full screen</strong> and in <strong>landscape</strong> (sideways) mode.
        </p>
        <ul className="text-muted mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>A wide pad lets you sign naturally without running out of space.</li>
          <li>Full screen hides distractions, so your finger doesn&apos;t scroll the page by accident.</li>
          <li>You&apos;ll see a live preview of how it looks on your ID before saving.</li>
        </ul>
        <p className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--line)" }}>
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          If your phone doesn&apos;t rotate by itself, turn it sideways and make sure rotation lock is off.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Not now
          </button>
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            <PenLine className="h-4 w-4" aria-hidden /> Open signature pad
          </button>
        </div>
      </div>
    </div>
  );
}

type Mode = "draw" | "upload";

export default function SignatureField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  error?: string;
}) {
  const [mode, setMode] = useState<Mode>("draw");
  const [intro, setIntro] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function chooseMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setUploadError("");
    onChange("");
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError("");
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Please choose a PNG or JPG image of your signature.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setUploadError(`The image must be ${MAX_UPLOAD_MB} MB or smaller.`);
      return;
    }
    setBusy(true);
    try {
      const result = await signatureFromFile(file);
      if (!result) setUploadError("We couldn't find a signature in that image. Use dark ink on plain white paper, then try again.");
      else onChange(result);
    } catch {
      setUploadError("That image couldn't be read. Please try another file.");
    } finally {
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
      active ? "border-[var(--accent-fill)] bg-[color-mix(in_srgb,var(--accent-fill)_12%,var(--card))]" : "border-[var(--line-strong)]"
    }`;

  return (
    <div id="student_signature" tabIndex={-1} className="outline-none">
      <p className="lbl mb-1 flex items-center gap-1.5">
        <PenLine className="h-4 w-4" aria-hidden />
        Student Signature <span style={{ color: "var(--danger)" }}>*</span>
      </p>
      <p className="text-muted mb-3 text-xs leading-relaxed">
        This is printed on the front of your ID. Choose whichever is easier for you.
      </p>

      <div className="flex gap-2" role="radiogroup" aria-label="How do you want to provide your signature?">
        <button type="button" role="radio" aria-checked={mode === "draw"} className={tabClass(mode === "draw")} onClick={() => chooseMode("draw")}>
          <PenLine className="h-4 w-4" aria-hidden /> Sign manually
        </button>
        <button type="button" role="radio" aria-checked={mode === "upload"} className={tabClass(mode === "upload")} onClick={() => chooseMode("upload")}>
          <ImageUp className="h-4 w-4" aria-hidden /> Upload e-signature
        </button>
      </div>

      <div
        className="mt-3 rounded-md border p-3"
        style={{ borderColor: error ? "var(--danger)" : "var(--line-strong)", background: "var(--card)" }}
      >
        {value ? (
          <div className="mx-auto max-w-sm">
            <IdSignaturePreview src={value} />
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ color: "var(--success)" }}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Signature ready — it fits your ID.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => (mode === "draw" ? setIntro(true) : fileRef.current?.click())}
              >
                {mode === "draw" ? <PenLine className="h-4 w-4" aria-hidden /> : <ImageUp className="h-4 w-4" aria-hidden />}
                {mode === "draw" ? "Sign again" : "Choose another image"}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange("")}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </button>
            </div>
          </div>
        ) : mode === "draw" ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <p className="text-muted max-w-sm text-xs leading-relaxed">
              We&apos;ll open a roomy signing pad on your screen with a live preview of how it looks on your ID.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setIntro(true)}>
              <PenLine className="h-4 w-4" aria-hidden /> Open signature pad
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <ul className="text-muted max-w-sm list-disc space-y-1 pl-5 text-left text-xs leading-relaxed">
              <li>Sign on plain white paper with a dark pen and take a clear, well-lit photo.</li>
              <li>A PNG with a transparent background works best. JPG or PNG, up to {MAX_UPLOAD_MB} MB.</li>
              <li>We trim the empty space and fit it to your ID automatically.</li>
            </ul>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImageUp className="h-4 w-4" aria-hidden /> {busy ? "Preparing…" : "Choose signature image"}
            </button>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} onChange={pickFile} aria-label="Upload signature image" />

      {(uploadError || error) && (
        <p className="field-error" role="alert">
          {uploadError || error}
        </p>
      )}

      {intro && (
        <LandscapeIntro
          onCancel={() => setIntro(false)}
          onContinue={() => {
            setIntro(false);
            setPadOpen(true);
            void enterLandscape();
          }}
        />
      )}
      {padOpen && (
        <SignaturePadModal
          onCancel={() => setPadOpen(false)}
          onSave={(url) => {
            onChange(url);
            setPadOpen(false);
          }}
        />
      )}
    </div>
  );
}
