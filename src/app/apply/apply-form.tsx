"use client";

import {
  Camera,
  CheckCircle2,
  ImageUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
  ZoomIn,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { BLOOD_TYPES, GRADE_LEVELS, TRACK_STRANDS } from "@/lib/fields";

type FieldErrors = Record<string, string>;

const MAX_PHOTO_MB = 5;
const CROP_W = 300;
const CROP_H = 400;

// ---------------------------------------------------------------------------
// Canvas crop editor (native Canvas only — zero extra dependencies)
// ---------------------------------------------------------------------------
function CropModal({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clamp = useCallback(
    (p: { x: number; y: number }, s: number) => {
      const img = imgRef.current;
      if (!img) return p;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      return {
        x: Math.min(0, Math.max(CROP_W - w, p.x)),
        y: Math.min(0, Math.max(CROP_H - h, p.y)),
      };
    },
    [],
  );

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const cover = Math.max(CROP_W / img.naturalWidth, CROP_H / img.naturalHeight);
      setScale(cover);
      setMinScale(cover);
      setPos({
        x: (CROP_W - img.naturalWidth * cover) / 2,
        y: (CROP_H - img.naturalHeight * cover) / 2,
      });
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CROP_W, CROP_H);
    ctx.drawImage(img, pos.x, pos.y, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.strokeStyle = "rgba(229,168,35,.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CROP_W - 2, CROP_H - 2);
  }, [scale, pos]);

  const confirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const factor = 2;
    const out = document.createElement("canvas");
    out.width = CROP_W * factor;
    out.height = CROP_H * factor;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      clamp(pos, scale).x * factor,
      clamp(pos, scale).y * factor,
      img.naturalWidth * scale * factor,
      img.naturalHeight * scale * factor,
    );
    out.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(blob, URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className="modal-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Adjust Photo</h3>
          <button type="button" className="btn-ghost btn btn-sm" onClick={onCancel} aria-label="Cancel crop">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-muted mb-3 text-xs">
          Drag to position and use the slider to zoom. The photo is cropped to a
          3×4 ID portrait.
        </p>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={CROP_W}
            height={CROP_H}
            className="touch-none rounded-md"
            style={{ cursor: "grab", maxWidth: "100%" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setPos(
                clamp(
                  {
                    x: drag.current.px + (e.clientX - drag.current.x),
                    y: drag.current.py + (e.clientY - drag.current.y),
                  },
                  scale,
                ),
              );
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>
          <ZoomIn className="h-4 w-4" aria-hidden />
          Zoom
          <input
            type="range"
            min={minScale}
            max={minScale * 3}
            step={0.01}
            value={scale}
            onChange={(e) => {
              const s = Number(e.target.value);
              setScale(s);
              setPos((p) => clamp(p, s));
            }}
            className="w-full"
            aria-label="Zoom photo"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            Use this photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webcam capture
// ---------------------------------------------------------------------------
function CameraModal({
  onCaptured,
  onCancel,
}: {
  onCaptured: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera capture is not supported by this browser. Please use file upload instead.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setError("Camera access was denied or is unavailable. You may upload a photo file instead.");
        }
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCaptured(canvas.toDataURL("image/jpeg", 0.95));
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Take photo">
      <div className="modal-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Take Photo</h3>
          <button type="button" className="btn-ghost btn btn-sm" onClick={onCancel} aria-label="Close camera">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--line-strong)", color: "var(--danger)" }}>
            {error}
          </p>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-md bg-black"
              aria-label="Camera preview"
            />
            <p className="text-muted mt-2 text-xs">
              Use a plain, well-lit background. Face the camera straight on — no filters,
              hats, or sunglasses.
            </p>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          {!error && (
            <button type="button" className="btn btn-primary" onClick={capture}>
              <Camera className="h-4 w-4" aria-hidden /> Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main application form
// ---------------------------------------------------------------------------
const EMPTY_VALUES: Record<string, string> = {
  studentIdNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  address: "",
  gradeLevel: "",
  trackStrand: "",
  email: "",
  contactNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bloodType: "",
  consent: "",
};

export default function ApplyForm({
  csrfToken,
  tokenLabel,
  privacyNotice,
}: {
  csrfToken: string;
  tokenLabel: string;
  privacyNotice: string;
}) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successCode, setSuccessCode] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cropSrc, setCropSrc] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());
  const submissionInFlight = useRef(false);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const releasePreviewUrl = (url: string) => {
    if (url.startsWith("blob:") && previewUrls.current.delete(url)) {
      URL.revokeObjectURL(url);
    }
  };

  const isShs = values.gradeLevel === "Grade 11" || values.gradeLevel === "Grade 12";

  const set = (name: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) =>
      name === "gradeLevel" && value !== "Grade 11" && value !== "Grade 12"
        ? { ...v, gradeLevel: value, trackStrand: "" }
        : { ...v, [name]: value },
    );
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      if (name === "gradeLevel") delete next.trackStrand;
      return next;
    });
  };

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoError("Only JPG or PNG images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`Photo must be ${MAX_PHOTO_MB} MB or smaller.`);
      e.target.value = "";
      return;
    }
    setPhotoError("");
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    setCropSrc(previewUrl);
    e.target.value = "";
  };

  const setPhotoError = (message: string) =>
    setErrors((prev) => ({ ...prev, photo: message }));

  const applyCropped = (blob: Blob, previewUrl: string) => {
    setPhotoBlob(blob);
    if (photoUrl) releasePreviewUrl(photoUrl);
    if (cropSrc) releasePreviewUrl(cropSrc);
    previewUrls.current.add(previewUrl);
    setPhotoUrl(previewUrl);
    setCropSrc("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
  };

  const clearPhoto = () => {
    setPhotoBlob(null);
    if (photoUrl) releasePreviewUrl(photoUrl);
    setPhotoUrl("");
  };

  const closeCrop = () => {
    if (cropSrc) releasePreviewUrl(cropSrc);
    setCropSrc("");
  };

  const resetAll = () => {
    setValues(EMPTY_VALUES);
    setErrors({});
    setServerError("");
    setSuccessCode("");
    clearPhoto();
    closeCrop();
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || submissionInFlight.current) return;
    setServerError("");
    setErrors({});
    if (!photoBlob) {
      setPhotoError("An ID photo is required to submit your application.");
      document.getElementById("photo_upload")?.focus();
      return;
    }

    submissionInFlight.current = true;
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) fd.set(k, v);
    fd.set("consent", values.consent ? "true" : "");
    if (photoBlob) fd.set("photo", photoBlob, "photo.jpg");

    setSubmitting(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; applicationCode: string }
        | { ok: false; error: string; errors?: FieldErrors }
        | null;

      if (!data) {
        setServerError("An unexpected error occurred. Please try again.");
        return;
      }
      if (res.status === 201 && data.ok) {
        setSuccessCode(data.applicationCode);
        return;
      }
      if ("errors" in data && data.errors) {
        setErrors(data.errors);
        const first = Object.keys(data.errors)[0];
        if (first) document.getElementById(`f_${first}`)?.focus();
      }
      setServerError("error" in data ? data.error : "Submission failed. Please review the form.");
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  const field = (
    name: keyof typeof EMPTY_VALUES,
    label: string,
    opts: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      autoComplete?: string;
      inputMode?: "text" | "tel" | "email" | "numeric";
      hint?: string;
      half?: boolean;
    } = {},
  ) => (
    <div className={opts.half ? "" : "sm:col-span-2"}>
      <label className="lbl" htmlFor={`f_${name}`}>
        {label}
        {opts.required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      <input
        id={`f_${name}`}
        name={name}
        type={opts.type || "text"}
        className="inp"
        required={opts.required}
        value={values[name]}
        onChange={set(name)}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete}
        inputMode={opts.inputMode}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `e_${name}` : opts.hint ? `h_${name}` : undefined}
      />
      {opts.hint && !errors[name] && (
        <p id={`h_${name}`} className="text-muted mt-1 text-xs">
          {opts.hint}
        </p>
      )}
      {errors[name] && (
        <p id={`e_${name}`} className="field-error" role="alert">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="application-form">
      <div className="mb-6">
        <div className="card overflow-hidden">
          <div className="h-1" style={{ background: "var(--accent-gold)" }} />
          <div className="p-5 sm:p-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--academic-blue)" }}>
              San Jose Adventist Academy · Student Services
            </p>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Student ID Application</h1>
            <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed">
              Complete the details below to request your official school ID. Your
              application will be reviewed by the Administration Office.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">Application campaign</span>
              <span
                className="inline-flex max-w-full items-center rounded-full border px-3 py-1 font-semibold"
                style={{ borderColor: "var(--line-strong)", color: "var(--academic-blue)" }}
              >
                <span className="truncate">{tokenLabel}</span>
              </span>
            </div>
          </div>
        </div>
        <section className="mt-4 rounded-md border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--card)" }} aria-label="What to prepare">
          <h2 className="text-xs font-bold">Before you begin</h2>
          <ul className="text-muted mt-2 grid gap-2 text-xs leading-relaxed sm:grid-cols-3 sm:gap-4">
            <li>Have your Student ID / LRN, current grade level, and an email address you can access ready.</li>
            <li>Prepare a recent, clear JPG or PNG photo (maximum 5 MB).</li>
            <li>Your email is required so the school can send application updates.</li>
          </ul>
        </section>
      </div>

      {serverError && (
        <div
          className="mb-5 flex items-start gap-2 rounded-md border px-4 py-3 text-sm"
          style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 8%, var(--card))" }}
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} aria-hidden />
          <span>{serverError}</span>
        </div>
      )}

      {/* --- Student information --- */}
      <section className="card mb-5 p-5">
        <h2 className="mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide" style={{ borderColor: "var(--line)" }}>
          1 · Student Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("studentIdNumber", "Student ID / LRN Number", {
            required: true,
            placeholder: "e.g. 123456789012",
            autoComplete: "off",
          })}
          {field("firstName", "First Name", { required: true, autoComplete: "given-name", half: true })}
          {field("middleName", "Middle Name (optional)", { autoComplete: "additional-name", half: true })}
          {field("lastName", "Last Name", { required: true, autoComplete: "family-name", half: true })}
          {field("suffix", "Suffix (optional)", { placeholder: "e.g. Jr., III", half: true })}
          <div className="sm:col-span-2">
            <label className="lbl" htmlFor="f_address">
              Address <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              id="f_address"
              className="inp"
              rows={2}
              value={values.address}
              onChange={set("address")}
              autoComplete="street-address"
              aria-invalid={Boolean(errors.address)}
            />
            {errors.address && (
              <p className="field-error" role="alert">
                {errors.address}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="lbl" htmlFor="f_gradeLevelSel">
              Grade Level <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <select
              id="f_gradeLevelSel"
              className="inp"
              value={values.gradeLevel}
              onChange={set("gradeLevel")}
              aria-invalid={Boolean(errors.gradeLevel)}
            >
              <option value="">Select grade level…</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {errors.gradeLevel && (
              <p className="field-error" role="alert">
                {errors.gradeLevel}
              </p>
            )}
          </div>
          <div>
            <label className="lbl" htmlFor="f_trackStrand">
              Track / Strand {isShs ? <span style={{ color: "var(--danger)" }}>*</span> : <span className="normal-case">(available for Grade 11–12)</span>}
            </label>
            <select
              id="f_trackStrand"
              className="inp"
              value={values.trackStrand}
              onChange={set("trackStrand")}
              disabled={!isShs}
              aria-invalid={Boolean(errors.trackStrand)}
            >
              <option value="">{isShs ? "Select track / strand…" : "Select Grade 11 or 12 first"}</option>
              {TRACK_STRANDS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.trackStrand && (
              <p className="field-error" role="alert">
                {errors.trackStrand}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- Contact & emergency --- */}
      <section className="card mb-5 p-5">
        <h2 className="mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide" style={{ borderColor: "var(--line)" }}>
          2 · Contact &amp; Emergency Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("email", "Student Email Address", {
            type: "email",
            required: true,
            autoComplete: "email",
            inputMode: "email",
            hint: "Required so the school can send you application updates.",
            half: true,
          })}
          {field("contactNumber", "Contact Number (optional)", {
            inputMode: "tel",
            autoComplete: "tel",
            placeholder: "e.g. 0917 123 4567",
            half: true,
          })}
          {field("emergencyContactName", "Emergency Contact Person", {
            required: true,
            half: true,
          })}
          {field("emergencyContactPhone", "Emergency Contact Phone", {
            required: true,
            inputMode: "tel",
            placeholder: "e.g. 0917 123 4567",
            half: true,
          })}
          <div>
            <label className="lbl" htmlFor="f_bloodType">
              Student               Student Blood Type <span className="normal-case">(optional)</span>
            </label>
            <p className="text-muted mb-1 text-xs">Enter the applicant student&rsquo;s blood type, not the emergency contact&rsquo;s.</p>
            <select
              id="f_bloodType"
              className="inp"
              value={values.bloodType}
              onChange={set("bloodType")}
              aria-invalid={Boolean(errors.bloodType)}
            >
              <option value="">Select blood type…</option>
              {BLOOD_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {errors.bloodType && (
              <p className="field-error" role="alert">
                {errors.bloodType}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- Photo --- */}
      <section className="card mb-5 p-5">
        <h2 className="mb-1 border-b pb-2 text-sm font-bold uppercase tracking-wide" style={{ borderColor: "var(--line)" }}>
          3 · ID Photo <span style={{ color: "var(--danger)" }}>* Required</span>
        </h2>
        <p className="text-muted mb-4 mt-3 text-xs leading-relaxed">
          Provide a recent photo against a plain background. A photo is required for your ID. JPG or PNG, maximum{" "}
          {MAX_PHOTO_MB} MB. You can take a photo with your camera or upload one from
          your device, then crop it before submitting.
        </p>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div
            className="flex h-[200px] w-[150px] shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-dashed"
            style={{ borderColor: "var(--line-strong)", background: "var(--bg)" }}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Cropped ID photo preview" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8" style={{ color: "var(--muted)" }} aria-hidden />
            )}
          </div>
          <div className="flex w-full flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setCameraOpen(true)}>
                <Camera className="h-4 w-4" aria-hidden /> Use Camera
              </button>
              <button
                id="photo_upload"
                type="button"
                className="btn btn-outline"
                onClick={() => fileInputRef.current?.click()}
                aria-describedby={errors.photo ? "e_photo" : undefined}
              >
                <ImageUp className="h-4 w-4" aria-hidden /> Upload Photo
              </button>
              {photoBlob && (
                <button type="button" className="btn btn-ghost" onClick={clearPhoto}>
                  <X className="h-4 w-4" aria-hidden /> Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              className="hidden"
              onChange={pickFile}
              aria-label="Upload a photo file"
            />
            {photoBlob && (
              <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--success)" }}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Photo ready — it will be attached to your application.
              </p>
            )}
            {errors.photo && (
              <p id="e_photo" className="field-error" role="alert">
                {errors.photo}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- Privacy & consent --- */}
      <section className="card mb-6 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--academic-blue)" }} aria-hidden />
          Privacy Notice
        </h2>
        <p className="text-muted text-xs leading-relaxed">{privacyNotice}</p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input
            id="f_consent"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0"
            checked={Boolean(values.consent)}
            onChange={(e) => {
              setValues((v) => ({ ...v, consent: e.target.checked ? "on" : "" }));
              setErrors((prev) => {
                const next = { ...prev };
                delete next.consent;
                return next;
              });
            }}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "e_consent" : undefined}
          />
          <span>
            I have read and agree to the privacy notice above, and I confirm that the
            information I provided is true and correct.
          </span>
        </label>
        {errors.consent && (
          <p id="e_consent" className="field-error" role="alert">
            {errors.consent}
          </p>
        )}
      </section>

      <button type="submit" className="btn btn-gold w-full !py-3 text-base" disabled={submitting} aria-disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Submitting…
          </>
        ) : (
          "Submit Application"
        )}
      </button>
      <p className="text-muted mt-3 text-center text-xs">
        Fields marked <span style={{ color: "var(--danger)" }}>*</span> are required. You
        will receive an Application Control Number after submitting — please save it.
      </p>

      {/* Modals */}
      {cameraOpen && (
        <CameraModal
          onCancel={() => setCameraOpen(false)}
          onCaptured={(dataUrl) => {
            setCameraOpen(false);
            setCropSrc(dataUrl);
          }}
        />
      )}
      {cropSrc && (
        <CropModal src={cropSrc} onCancel={closeCrop} onConfirm={applyCropped} />
      )}
      {successCode && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Application submitted">
          <div className="modal-panel p-6 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(21,128,61,.12)" }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: "var(--success)" }} aria-hidden />
            </div>
            <h3 className="text-lg font-extrabold">Application Submitted</h3>
            <p className="text-muted mt-1 text-sm">
              Save your Application Control Number. The Administration Office will
              review your application and contact you using the email address you
              provided, if any.
            </p>
            <div
              className="my-5 select-all rounded-md border-2 px-4 py-3 font-mono text-xl font-bold tracking-widest"
              style={{ borderColor: "var(--accent-gold)", background: "color-mix(in srgb, var(--accent-gold) 10%, var(--card))" }}
            >
              {successCode}
            </div>
            <p className="text-muted text-xs leading-relaxed">
              What happens next: the Administration Office reviews your photo and
              information, prints your ID, and notifies you when it is ready for claiming.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={resetAll}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Submit another application
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
