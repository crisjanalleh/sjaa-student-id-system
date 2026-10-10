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
  { value: "twilight", label: "Twilight", hint: "Softer dark, easier on the eyes", Icon: MoonStar },
  { value: "dark", label: "Dark", hint: "Full dark background", Icon: Moon },
];

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribePreferences,
    () => getPreferences().theme,
    () => DEFAULT_PREFERENCES.theme,
  );

  return (
    <div className="pref-segment" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map(({ value, label, hint, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={hint}
          onClick={() => updatePreferences({ theme: value })}
        >
          <span className="flex items-center justify-center gap-1">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
