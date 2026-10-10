"use client";

import { useLayoutEffect } from "react";
import { applySavedTheme } from "@/lib/preferences";

/**
 * The sign-in page always follows the device's light/dark setting. Any theme
 * saved from the workspace is ignored here and restored when leaving the page.
 */
export default function DeviceTheme() {
  useLayoutEffect(() => {
    document.documentElement.removeAttribute("data-theme");
    return () => applySavedTheme();
  }, []);
  return null;
}
