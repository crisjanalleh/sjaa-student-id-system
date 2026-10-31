"use client";

import { CheckCircle2, ChevronDown, Eye, Loader2, RotateCcw, Save, SlidersHorizontal, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { SAMPLE_CARD_DATA, ScaledIdCard } from "@/components/id-card";
import type { AdminTemplateConfig, CardDesignSettings } from "@/db/schema";
import { DEFAULT_CARD_DESIGN } from "@/lib/card-design";

type Values = AdminTemplateConfig;

function ResponsiveCardPreview({
  variant,
  template,
  gradeLevel,
  className = "",
}: {
  variant: "front" | "back";
  template: AdminTemplateConfig;
  gradeLevel: string;
  className?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const cardWidthMm = 53.98;
  const cardHeightMm = 85.6;
  const maxScale = 1.55;
  const scale = width
    ? Math.min(maxScale, Math.max(0.4, (width - 8) / (cardWidthMm * 3.7795)))
    : 0.8;

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={stage} className={`flex min-w-0 justify-center overflow-hidden py-1 ${className}`} style={{ minHeight: cardHeightMm * 3.7795 * scale + 8 }}>
      <ScaledIdCard scale={scale} variant={variant} data={{ ...SAMPLE_CARD_DATA, gradeLevel }} template={template} />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-md border px-3 py-2.5"
      style={{ borderColor: "var(--line)" }}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted block text-xs">{description}</span>
      </span>
      <span
        className="relative mt-0.5 block shrink-0 rounded-full transition-colors"
        style={{ width: 40, height: 22, background: checked ? "var(--academic-blue)" : "var(--line-strong)" }}
      >
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="absolute rounded-full bg-white shadow transition-[left]"
          style={{ top: 2, width: 18, height: 18, left: checked ? 20 : 2 }}
          aria-hidden
        />
      </span>
    </label>
  );
}

export default function TemplateEditor({
  initial,
  initialVersion,
  csrfToken,
}: {
  initial: Values;
  initialVersion: number;
  csrfToken: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ ...initial, orientation: "portrait" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewLevel, setPreviewLevel] = useState<"shs" | "jhs">("shs");
  const previewGrade = previewLevel === "shs" ? "Grade 11" : "Grade 9";
  const [version, setVersion] = useState(initialVersion);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ ...initial, orientation: "portrait" }));
  const [staleVersion, setStaleVersion] = useState(false);
  const [adjustmentPanel, setAdjustmentPanel] = useState<"signature" | "layout" | null>(null);
  const requestInFlight = useRef(false);
  const signatureInput = useRef<HTMLInputElement>(null);
  const hasUnsavedChanges = JSON.stringify(values) !== savedSnapshot;

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };
  const setDesign = <K extends keyof CardDesignSettings>(key: K, value: CardDesignSettings[K]) => {
    setValues((current) => ({
      ...current,
      designSettings: { ...current.designSettings, [key]: value },
    }));
    setSaved(false);
  };

  async function loadSignature(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setErrors((current) => ({ ...current, signature: "Choose a PNG or JPG image." }));
      return;
    }
    if (file.size > 1024 * 1024) {
      setErrors((current) => ({ ...current, signature: "The image must be 1 MB or smaller." }));
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image could not be read."));
        reader.onerror = () => reject(new Error("Image could not be read."));
        reader.readAsDataURL(file);
      });
      setDesign("signatorySignature", dataUrl);
      setErrors((current) => {
        const { signature: _signature, ...rest } = current;
        return rest;
      });
    } catch {
      setErrors((current) => ({ ...current, signature: "The image could not be read. Please choose another file." }));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setErrors({});
    setServerError("");
    setStaleVersion(false);
    try {
      const res = await fetch("/api/admin/template", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ ...values, version }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; version?: number; signature?: string | null; error?: string; errors?: Record<string, string> }
        | null;
      if (res.ok && data?.ok) {
        const savedVersion = typeof data.version === "number" ? data.version : version + 1;
        const savedValues: Values = {
          ...values,
          designSettings: {
            ...values.designSettings,
            signatorySignature: data.signature === undefined
              ? values.designSettings.signatorySignature
              : data.signature,
          },
        };
        setVersion(savedVersion);
        setValues(savedValues);
        setSavedSnapshot(JSON.stringify(savedValues));
        setSaved(true);
        router.refresh();
        return;
      }
      if (data?.errors) setErrors(data.errors);
      if (res.status === 409) setStaleVersion(true);
      setServerError(data?.error || "Save failed. Please try again.");
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Editor panel */}
        <section className="card h-fit p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            </span>
            Template Settings
          </h2>

          {serverError && (
            <div className="mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--danger)" }} role="alert">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
              <span>{serverError}</span>
              {staleVersion && (
                <button type="button" className="btn btn-outline btn-sm ml-auto" onClick={() => window.location.reload()}>
                  Reload latest
                </button>
              )}
            </div>
          )}
          {saved && (
            <div className="mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--success)", color: "var(--success)" }} role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Template version {version} saved successfully.
            </div>
          )}

          <div className="mb-4 flex flex-col gap-2.5">
            <Toggle
              id="tgl_track"
              label="Track / Strand"
              description="Show the SHS track/strand beside the grade level and on the back."
              checked={values.showTrackStrand}
              onChange={(v) => set("showTrackStrand", v)}
            />
            <Toggle
              id="tgl_emergency"
              label="Emergency Contact"
              description="Show the emergency contact block on the card back."
              checked={values.showEmergencyContact}
              onChange={(v) => set("showEmergencyContact", v)}
            />
          </div>

          <div className="mb-4">
            <label className="lbl" htmlFor="tpl_sy">
              School Year
            </label>
            <input
              id="tpl_sy"
              className="inp"
              value={values.schoolYear}
              onChange={(e) => set("schoolYear", e.target.value)}
              placeholder="e.g. 2026-2027"
              maxLength={20}
              aria-invalid={Boolean(errors.schoolYear)}
            />
            {errors.schoolYear && <p className="field-error" role="alert">{errors.schoolYear}</p>}
          </div>
          <p className="text-muted mb-4 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--line)" }}>
            Card orientation is fixed to portrait at standard CR80 dimensions (53.98 × 85.60 mm).
          </p>
          <div className="mb-4">
            <label className="lbl" htmlFor="tpl_signame">
              Principal&rsquo;s Name
            </label>
            <input
              id="tpl_signame"
              className="inp"
              value={values.signatoryName}
              onChange={(e) => set("signatoryName", e.target.value)}
              placeholder="Enter the principal&rsquo;s name"
              maxLength={150}
            />
          </div>
          <p className="text-muted mb-4 rounded-md border px-3 py-2 text-xs leading-relaxed" style={{ borderColor: "var(--line)" }} role="note">
            Use the current principal&rsquo;s verified name and title. The reference image is blurry, so do not rely on text guessed from the sample when preparing official cards.
          </p>
          <div className="mb-5">
            <label className="lbl" htmlFor="tpl_sigtitle">
              Principal&rsquo;s Title
            </label>
            <input
              id="tpl_sigtitle"
              className="inp"
              value={values.signatoryTitle}
              onChange={(e) => set("signatoryTitle", e.target.value)}
              placeholder="e.g. School Principal"
              maxLength={150}
              aria-invalid={Boolean(errors.signatoryTitle)}
            />
            {errors.signatoryTitle && <p className="field-error" role="alert">{errors.signatoryTitle}</p>}
          </div>

          <section className="mb-5 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
            <div className="mb-2">
              <h3 className="text-sm font-bold">Principal&rsquo;s Signature</h3>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                Upload the school principal&rsquo;s approved handwritten signature as a PNG or JPG. A transparent PNG gives the closest match to the supplied card reference. This is a printed image, not a cryptographic or legally verified digital signature.
              </p>
            </div>
            <input
              ref={signatureInput}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={loadSignature}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => signatureInput.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden />
                {values.designSettings.signatorySignature ? "Replace signature" : "Upload signature"}
              </button>
              {values.designSettings.signatorySignature && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDesign("signatorySignature", null)}
                  aria-label="Remove signature image"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove
                </button>
              )}
            </div>
            {errors.signature && <p className="field-error" role="alert">{errors.signature}</p>}
            {values.designSettings.signatorySignature && (
              <div className="mt-3 flex h-12 items-center justify-center rounded-md border bg-white p-2" style={{ borderColor: "var(--line)" }}>
                {/* This preview uses the server-normalized PNG representation. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={values.designSettings.signatorySignature} alt="Signatory signature preview" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <p className="mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed" style={{ borderColor: "var(--line)", background: "var(--bg)" }} role="note">
              <strong>Image guidance:</strong> Transparent PNG signatures are recommended. White or solid-color backgrounds are retained and may be visible on the printed card.
            </p>
          </section>

          {/* Modernized adjustment panels */}
          <div className="mb-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--elevated)] shadow-xs">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg)]/50"
              onClick={() => setAdjustmentPanel(adjustmentPanel === "signature" ? null : "signature")}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <SlidersHorizontal className="h-4 w-4 text-[var(--academic-blue)]" />
                Optional signature size & placement
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${adjustmentPanel === "signature" ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${adjustmentPanel === "signature" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-[var(--line)]/50 px-4 pb-4 pt-3">
                  <p className="text-muted mb-4 text-xs leading-relaxed">
                    Changes update the live preview after saving. The saved image keeps its original detail while being resized for display.
                  </p>
                  <div className="mb-4">
                    <label className="lbl flex justify-between" htmlFor="design_signature_scale">
                      <span>Signature size</span><span>{Math.round(values.designSettings.signatoryScale * 100)}%</span>
                    </label>
                    <input id="design_signature_scale" type="range" min="0.6" max="1.8" step="0.05" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.signatoryScale} onChange={(e) => setDesign("signatoryScale", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl" htmlFor="design_signature_x">Horizontal placement · {values.designSettings.signatoryOffsetX.toFixed(1)} mm</label>
                    <input id="design_signature_x" type="range" min="-8" max="8" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.signatoryOffsetX} onChange={(e) => setDesign("signatoryOffsetX", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl" htmlFor="design_signature_y">Vertical placement · {values.designSettings.signatoryOffsetY.toFixed(1)} mm</label>
                    <input id="design_signature_y" type="range" min="-5" max="5" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.signatoryOffsetY} onChange={(e) => setDesign("signatoryOffsetY", Number(e.target.value))} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setValues((current) => ({
                        ...current,
                        designSettings: {
                          ...current.designSettings,
                          signatoryScale: 1,
                          signatoryOffsetX: 0,
                          signatoryOffsetY: 0,
                        },
                      }));
                      setSaved(false);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset signature placement
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--elevated)] shadow-xs">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg)]/50"
              onClick={() => setAdjustmentPanel(adjustmentPanel === "layout" ? null : "layout")}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <SlidersHorizontal className="h-4 w-4 text-[var(--academic-blue)]" />
                Optional card layout adjustments
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${adjustmentPanel === "layout" ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${adjustmentPanel === "layout" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-[var(--line)]/50 px-4 pb-4 pt-3">
                  <p className="text-muted mb-4 text-xs leading-relaxed">
                    These controls adjust the front layout. Open this panel while viewing the preview; use Reset to return to the standard layout.
                  </p>
                  <div className="mb-4">
                    <label className="lbl flex justify-between" htmlFor="design_name_size">
                      <span>Student name size</span><span>{values.designSettings.nameFontSize.toFixed(1)} px</span>
                    </label>
                    <input id="design_name_size" type="range" min="8" max="14" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.nameFontSize} onChange={(e) => setDesign("nameFontSize", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl flex justify-between" htmlFor="design_detail_scale">
                      <span>Supporting text size</span><span>{Math.round(values.designSettings.detailFontScale * 100)}%</span>
                    </label>
                    <input id="design_detail_scale" type="range" min="0.8" max="1.25" step="0.05" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.detailFontScale} onChange={(e) => setDesign("detailFontScale", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl" htmlFor="design_name_x">Name horizontal position · {values.designSettings.nameOffsetX.toFixed(1)} mm</label>
                    <input id="design_name_x" type="range" min="-5" max="5" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.nameOffsetX} onChange={(e) => setDesign("nameOffsetX", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl" htmlFor="design_name_y">Name vertical position · {values.designSettings.nameOffsetY.toFixed(1)} mm</label>
                    <input id="design_name_y" type="range" min="-5" max="5" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.nameOffsetY} onChange={(e) => setDesign("nameOffsetY", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl flex justify-between" htmlFor="design_photo_scale">
                      <span>Photo size</span><span>{Math.round(values.designSettings.photoScale * 100)}%</span>
                    </label>
                    <input id="design_photo_scale" type="range" min="0.8" max="1.25" step="0.05" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.photoScale} onChange={(e) => setDesign("photoScale", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl" htmlFor="design_photo_x">Photo horizontal position · {values.designSettings.photoOffsetX.toFixed(1)} mm</label>
                    <input id="design_photo_x" type="range" min="-5" max="5" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.photoOffsetX} onChange={(e) => setDesign("photoOffsetX", Number(e.target.value))} />
                  </div>
                  <div className="mb-4">
                    <label className="lbl" htmlFor="design_photo_y">Photo vertical position · {values.designSettings.photoOffsetY.toFixed(1)} mm</label>
                    <input id="design_photo_y" type="range" min="-5" max="5" step="0.5" className="w-full accent-[var(--academic-blue)]"
                      value={values.designSettings.photoOffsetY} onChange={(e) => setDesign("photoOffsetY", Number(e.target.value))} />
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("designSettings", { ...DEFAULT_CARD_DESIGN, signatorySignature: values.designSettings.signatorySignature })}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset layout
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-gold w-full" disabled={busy || !hasUnsavedChanges}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {busy ? "Saving template…" : hasUnsavedChanges ? "Save Template" : "Save Changes"}
          </button>
        </section>

        {/* Live preview with sample data only (no real student records). */}
        <section className="lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--card)]/60 px-5 py-3.5">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--academic-blue)]/12 text-[var(--academic-blue)]">
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  Live Preview
                </h2>
                <p className="text-muted mt-1.5 text-xs leading-relaxed">
                  Sample data shown for layout only — actual records are never rendered here.
                </p>
              </div>

              <div
                className="flex gap-1 rounded-full border border-[var(--line)] bg-[var(--elevated)] p-1"
                role="group"
                aria-label="Preview level"
              >
                {(["shs", "jhs"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`min-w-[7.5rem] rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-colors duration-300 sm:min-w-[9.5rem] ${
                      previewLevel === level
                        ? "bg-[var(--accent-fill)] text-white shadow-sm"
                        : "text-muted hover:text-[var(--ink)]"
                    }`}
                    aria-pressed={previewLevel === level}
                    onClick={() => setPreviewLevel(level)}
                  >
                    {level === "shs" ? "Senior High" : "Junior High"}
                  </button>
                ))}
              </div>
            </div>

            <div className="id-preview-stage p-5">
              <div className="grid min-w-0 gap-5 2xl:grid-cols-2">
                {(
                  [
                    { variant: "front", label: "Front", hint: "Portrait · CR80 53.98 × 85.60 mm" },
                    { variant: "back", label: "Back", hint: "Validation grid & signatory" },
                  ] as const
                ).map((face) => (
                  <figure key={face.variant} className="id-preview-tile">
                    {/* Placeholder slot to keep previews level */}
                    <div className="flex min-h-2 items-center justify-center" aria-hidden="true" />
                    
                    <figcaption className="flex flex-wrap items-center justify-between gap-2">
                      <span className="id-preview-chip">{face.label}</span>
                      <span className="text-muted text-[11px]">{face.hint}</span>
                    </figcaption>
                    <ResponsiveCardPreview
                      key={face.variant === "front" ? `${face.variant}-${previewLevel}` : face.variant}
                      variant={face.variant}
                      template={values}
                      gradeLevel={previewGrade}
                      className={face.variant === "front" ? "id-preview-swap" : ""}
                    />
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
