"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

export default function ThemeToggle() {
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const toggle = () => {
    const current = document.documentElement.dataset.theme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sjaa-theme", next); // non-PII preference only
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <Sun className="theme-toggle-sun h-4 w-4" aria-hidden />
      <Moon className="theme-toggle-moon h-4 w-4" aria-hidden />
      {storageUnavailable && <span className="sr-only">Theme preference will not be saved</span>}
    </button>
  );
}
