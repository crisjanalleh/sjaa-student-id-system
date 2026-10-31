"use client";

import { Accessibility, ChevronDown, LayoutGrid, Palette, RotateCcw, Type } from "lucide-react";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import ThemeToggle from "@/components/theme-toggle";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  resetPreferences,
  subscribePreferences,
  updatePreferences,
  type ColorFilterPreference,
  type DensityPreference,
  type FontPreference,
  type TypefacePreference,
} from "@/lib/preferences";

const DENSITIES: { value: DensityPreference; label: string; desc: string }[] = [
  { value: "compact", label: "Compact", desc: "Dense view" },
  { value: "default", label: "Default", desc: "Balanced" },
  { value: "comfort", label: "Comfort", desc: "Spacious" },
];

const FONTS: { value: FontPreference; label: string; code: string; sample: string }[] = [
  { value: "small", label: "Small", code: "S", sample: "text-[11px]" },
  { value: "default", label: "Default", code: "M", sample: "text-xs" },
  { value: "large", label: "Large", code: "L", sample: "text-sm" },
  { value: "xlarge", label: "X-Large", code: "XL", sample: "text-base" },
];

const TYPEFACES: { value: TypefacePreference; label: string; note: string; family: string }[] = [
  { value: "segoe", label: "Segoe UI", note: "Windows system look", family: '"Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif' },
  { value: "calibri", label: "Calibri", note: "Compact, good for dense tables", family: 'Calibri, Candara, "Trebuchet MS", "Segoe UI", sans-serif' },
  { value: "arial", label: "Arial", note: "Neutral and familiar", family: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  { value: "verdana", label: "Verdana", note: "Wide letters, easiest to read", family: "Verdana, Tahoma, Geneva, sans-serif" },
  { value: "georgia", label: "Georgia", note: "Formal serif for a document feel", family: "Georgia, Cambria, 'Times New Roman', serif" },
];

const WEB_TYPEFACES: { value: TypefacePreference; label: string; note: string; family: string }[] = [
  { value: "inter", label: "Inter", note: "Default · built for screens, clear in tables", family: '"Inter Variable", Inter, system-ui, sans-serif' },
  { value: "roboto", label: "Roboto", note: "Familiar, neutral and compact", family: '"Roboto Variable", Roboto, system-ui, sans-serif' },
  { value: "opensans", label: "Open Sans", note: "Friendly and highly readable", family: '"Open Sans Variable", "Open Sans", system-ui, sans-serif' },
  { value: "poppins", label: "Poppins", note: "Rounded geometric, modern headings", family: "Poppins, system-ui, sans-serif" },
  { value: "montserrat", label: "Montserrat", note: "Wide, bold and contemporary", family: '"Montserrat Variable", Montserrat, system-ui, sans-serif' },
];

const COLOR_FILTERS: { value: ColorFilterPreference; label: string; note: string }[] = [
  { value: "none", label: "None", note: "Original colours" },
  { value: "protanopia", label: "Red-weak", note: "Protanopia" },
  { value: "deuteranopia", label: "Green-weak", note: "Deuteranopia" },
  { value: "tritanopia", label: "Blue-weak", note: "Tritanopia" },
  { value: "grayscale", label: "Grayscale", note: "No colour" },
];

/** Collapsible group with smooth expand/collapse animation */
export function WorkspaceSection({
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="ws-group" data-open={open}>
      <button
        type="button"
        className="ws-group-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="ws-group-title">{title}</span>
        {summary && !open ? <span className="ws-group-summary">{summary}</span> : null}
        <ChevronDown className="ws-group-chevron h-4 w-4" aria-hidden />
      </button>
      <div id={id} className="ws-group-body" inert={!open ? true : undefined}>
        <div className="ws-group-body-inner">
          {children}
        </div>
      </div>
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="pref-switch" onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className="pref-switch-track" aria-hidden />
    </button>
  );
}

export default function DisplayPreferences() {
  const prefs = useSyncExternalStore(subscribePreferences, getPreferences, () => DEFAULT_PREFERENCES);
  const [saveFailed, setSaveFailed] = useState(false);

  const change = (patch: Parameters<typeof updatePreferences>[0]) => setSaveFailed(!updatePreferences(patch));

  const typefaceButton = ({ value, label, note, family }: (typeof TYPEFACES)[number]) => (
    <button key={value} type="button" role="radio" aria-checked={prefs.typeface === value} onClick={() => change({ typeface: value })}>
      <span className="pref-list-font" style={{ fontFamily: family }}>{label}</span>
      <span className="pref-list-note">{note}</span>
    </button>
  );
  const activeTypeface = [...WEB_TYPEFACES, ...TYPEFACES].find((t) => t.value === prefs.typeface)?.label;
  const densityLabel = DENSITIES.find((d) => d.value === prefs.density)?.label;
  const sizeLabel = FONTS.find((f) => f.value === prefs.font)?.label;

  return (
    <>
      <WorkspaceSection title="Appearance" icon={<Palette className="h-4 w-4" aria-hidden />} summary={prefs.theme === "system" ? "Match device" : prefs.theme} defaultOpen>
        <p className="admin-workspace-section-title">Color theme</p>
        <ThemeToggle />
      </WorkspaceSection>

      <WorkspaceSection title="Typography" icon={<Type className="h-4 w-4" aria-hidden />} summary={`${activeTypeface} · ${sizeLabel}${prefs.bold ? " · Bold" : ""}`}>
        <p className="admin-workspace-section-title">Text size</p>
        <div className="pref-size-grid" role="radiogroup" aria-label="Text size">
          {FONTS.map(({ value, label, code, sample }) => (
            <button
              key={value}
              type="button"
              role="radio"
              className="pref-size-btn"
              aria-checked={prefs.font === value}
              title={`${label} text size`}
              aria-label={`${label} text size`}
              onClick={() => change({ font: value })}
            >
              <span className={`pref-size-sample ${sample}`} aria-hidden>Aa</span>
              <span className="pref-size-code">{code}</span>
            </button>
          ))}
        </div>
        <p className="text-muted mt-1.5 text-[10px] leading-snug">Scales the whole workspace interface.</p>
        <Switch label="Bold text" checked={prefs.bold} onChange={(bold) => change({ bold })} />
        <p className="admin-workspace-section-title mt-3">Modern web fonts</p>
        <div className="pref-list" role="radiogroup" aria-label="Modern web fonts">
          {WEB_TYPEFACES.map(typefaceButton)}
        </div>
        <p className="admin-workspace-section-title mt-3">System fonts</p>
        <div className="pref-list" role="radiogroup" aria-label="System fonts">
          {TYPEFACES.map(typefaceButton)}
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Layout" icon={<LayoutGrid className="h-4 w-4" aria-hidden />} summary={densityLabel}>
        <p className="admin-workspace-section-title">Layout density</p>
        <div className="pref-density-grid" role="radiogroup" aria-label="Layout density">
          {DENSITIES.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              role="radio"
              className="pref-density-btn"
              aria-checked={prefs.density === value}
              title={`${label} layout: ${desc}`}
              aria-label={`${label} layout density`}
              onClick={() => change({ density: value })}
            >
              <span className={`pref-density-preview density-${value}`} aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="pref-density-label">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-muted mt-1.5 text-[10px] leading-snug">
          Compact fits more rows; Comfort adds breathing space for touch devices.
        </p>
      </WorkspaceSection>

      <WorkspaceSection
        title="Accessibility"
        icon={<Accessibility className="h-4 w-4" aria-hidden />}
        summary={[prefs.contrast ? "High contrast" : "", prefs.reduceMotion ? "Reduced motion" : "", prefs.colorFilter !== "none" ? "Color filter" : ""].filter(Boolean).join(" · ") || "Default"}
      >
        <Switch label="High contrast" checked={prefs.contrast} onChange={(contrast) => change({ contrast })} />
        <Switch label="Reduce motion" checked={prefs.reduceMotion} onChange={(reduceMotion) => change({ reduceMotion })} />
        <p className="admin-workspace-section-title mt-3">Color filters</p>
        <div className="pref-list" role="radiogroup" aria-label="Color filters">
          {COLOR_FILTERS.map(({ value, label, note }) => (
            <button key={value} type="button" role="radio" aria-checked={prefs.colorFilter === value} onClick={() => change({ colorFilter: value })}>
              <span className="pref-list-font">{label}</span>
              <span className="pref-list-note">{note}</span>
            </button>
          ))}
        </div>
        <p className="text-muted mt-1.5 text-[10px] leading-snug">
          Helps tell colours apart for colour-blind users. Printed IDs are never affected.
        </p>
      </WorkspaceSection>

      <div className="flex items-center justify-between gap-2 px-2 pt-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaveFailed(!resetPreferences())}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset display
        </button>
        <span className="text-muted text-[10px]">Saved on this device</span>
      </div>
      {saveFailed && (
        <p className="mt-1 px-2 text-[11px]" style={{ color: "var(--danger)" }} role="alert">
          This browser blocked saving, so preferences apply only until you leave this page.
        </p>
      )}
    </>
  );
}
