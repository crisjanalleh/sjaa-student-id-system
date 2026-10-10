export type ThemePreference = "system" | "light" | "twilight" | "dark";
export type DensityPreference = "default" | "comfort" | "compact";
export type FontPreference = "small" | "default" | "large" | "xlarge";
export type TypefacePreference =
  | "inter" | "segoe" | "calibri" | "georgia" | "verdana" | "arial"
  | "roboto" | "opensans" | "poppins" | "montserrat";
export type ColorFilterPreference = "none" | "protanopia" | "deuteranopia" | "tritanopia" | "grayscale";

export type Preferences = {
  theme: ThemePreference;
  density: DensityPreference;
  font: FontPreference;
  typeface: TypefacePreference;
  contrast: boolean;
  reduceMotion: boolean;
  bold: boolean;
  colorFilter: ColorFilterPreference;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  density: "default",
  font: "default",
  typeface: "inter",
  contrast: false,
  reduceMotion: false,
  bold: false,
  colorFilter: "none",
};

export const PREFERENCE_EVENT = "sjaa-preferences";

const KEYS = {
  theme: "sjaa-theme",
  density: "sjaa-density",
  font: "sjaa-font",
  typeface: "sjaa-typeface",
  contrast: "sjaa-contrast",
  reduceMotion: "sjaa-motion",
  bold: "sjaa-bold",
  colorFilter: "sjaa-colorfilter",
} as const;

const THEMES: ThemePreference[] = ["light", "twilight", "dark"];
const DENSITIES: DensityPreference[] = ["comfort", "compact"];
const FONTS: FontPreference[] = ["small", "large", "xlarge"];
// "inter" is the default and is stored as the absence of a value; "segoe" is now an explicit choice.
const TYPEFACES: TypefacePreference[] = ["segoe", "calibri", "georgia", "verdana", "arial", "roboto", "opensans", "poppins", "montserrat"];
const COLOR_FILTERS: ColorFilterPreference[] = ["protanopia", "deuteranopia", "tritanopia", "grayscale"];

/** Runs before first paint (see layout.tsx) so saved preferences never flash. Keep in sync with KEYS. */
export const PREFERENCES_BOOT_SCRIPT = `(function(){var d=document.documentElement;function g(k){try{return localStorage.getItem(k)}catch(e){return null}}function s(a,v,ok){if(ok.indexOf(v)>-1){d.setAttribute(a,v)}else{d.removeAttribute(a)}}s('data-theme',location.pathname==='/admin/login'?null:g('${KEYS.theme}'),${JSON.stringify(THEMES)});s('data-density',g('${KEYS.density}'),${JSON.stringify(DENSITIES)});s('data-font',g('${KEYS.font}'),${JSON.stringify(FONTS)});s('data-typeface',g('${KEYS.typeface}'),${JSON.stringify(TYPEFACES)});s('data-contrast',g('${KEYS.contrast}'),['high']);s('data-motion',g('${KEYS.reduceMotion}'),['reduce']);s('data-bold',g('${KEYS.bold}'),['on']);s('data-colorfilter',g('${KEYS.colorFilter}'),${JSON.stringify(COLOR_FILTERS)});})();`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

let cachedKey = "";
let cached: Preferences = DEFAULT_PREFERENCES;

/** Stable snapshot for useSyncExternalStore: identical content returns the identical object. */
export function getPreferences(): Preferences {
  const next: Preferences = {
    theme: pick(read(KEYS.theme), THEMES, "system"),
    density: pick(read(KEYS.density), DENSITIES, "default"),
    font: pick(read(KEYS.font), FONTS, "default"),
    typeface: pick(read(KEYS.typeface), TYPEFACES, "inter"),
    contrast: read(KEYS.contrast) === "high",
    reduceMotion: read(KEYS.reduceMotion) === "reduce",
    bold: read(KEYS.bold) === "on",
    colorFilter: pick(read(KEYS.colorFilter), COLOR_FILTERS, "none"),
  };
  const key = JSON.stringify(next);
  if (key !== cachedKey) {
    cachedKey = key;
    cached = next;
  }
  return cached;
}

export function subscribePreferences(onChange: () => void): () => void {
  window.addEventListener(PREFERENCE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyToDocument(prefs: Preferences) {
  const root = document.documentElement;
  const set = (name: string, value: string | null) =>
    value ? root.setAttribute(name, value) : root.removeAttribute(name);
  set("data-theme", prefs.theme === "system" ? null : prefs.theme);
  set("data-density", prefs.density === "default" ? null : prefs.density);
  set("data-font", prefs.font === "default" ? null : prefs.font);
  set("data-typeface", prefs.typeface === "inter" ? null : prefs.typeface);
  set("data-contrast", prefs.contrast ? "high" : null);
  set("data-motion", prefs.reduceMotion ? "reduce" : null);
  set("data-bold", prefs.bold ? "on" : null);
  set("data-colorfilter", prefs.colorFilter === "none" ? null : prefs.colorFilter);
}

function store(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Saves one preference (non-personal, device-local) and applies it everywhere immediately. */
export function updatePreferences(patch: Partial<Preferences>): boolean {
  const next = { ...getPreferences(), ...patch };
  let saved = true;
  saved = store(KEYS.theme, next.theme === "system" ? null : next.theme) && saved;
  saved = store(KEYS.density, next.density === "default" ? null : next.density) && saved;
  saved = store(KEYS.font, next.font === "default" ? null : next.font) && saved;
  saved = store(KEYS.typeface, next.typeface === "inter" ? null : next.typeface) && saved;
  saved = store(KEYS.contrast, next.contrast ? "high" : null) && saved;
  saved = store(KEYS.reduceMotion, next.reduceMotion ? "reduce" : null) && saved;
  saved = store(KEYS.bold, next.bold ? "on" : null) && saved;
  saved = store(KEYS.colorFilter, next.colorFilter === "none" ? null : next.colorFilter) && saved;
  applyToDocument(next);
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
  return saved;
}

/** Re-applies the saved theme (or none, meaning follow the device) to <html>. */
export function applySavedTheme() {
  const theme = getPreferences().theme;
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function resetPreferences(): boolean {
  return updatePreferences(DEFAULT_PREFERENCES);
}
