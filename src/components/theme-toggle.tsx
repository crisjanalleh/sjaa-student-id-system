"use client";

import { Moon, MoonStar, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  subscribePreferences,
  updatePreferences,
  type ThemePreference,
} from "@/lib/preferences";

const OPTIONS: { value: Exclude<ThemePreference, "system">; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", hint: "Bright background", Icon: Sun },
  { value: "twilight", label: "Twilight", hint: "Balanced contrast, easier on eyes", Icon: MoonStar },
  { value: "dark", label: "Dark", hint: "Full dark background", Icon: Moon },
];

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribePreferences,
    () => getPreferences().theme,
    () => DEFAULT_PREFERENCES.theme,
  );

  return (
    <div className="theme-selector" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map(({ value, label, hint, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          className="theme-selector-btn"
          aria-checked={theme === value}
          title={`${label} theme: ${hint}`}
          aria-label={`${label} theme`}
          onClick={() => updatePreferences({ theme: value })}
        >
          <Icon className="theme-selector-icon" aria-hidden />
          <span className="theme-selector-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
