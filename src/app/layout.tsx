import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/roboto";
import "@fontsource-variable/open-sans";
import "@fontsource-variable/montserrat";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

import { PREFERENCES_BOOT_SCRIPT } from "@/lib/preferences";

export const metadata: Metadata = {
  title: {
    default: "SJAA Student ID Issuance System",
    template: "%s · SJAA ID System",
  },
  description:
    "San Jose Adventist Academy — Web-Based Student ID Issuance System with QR Code Access and Automated Template Generation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
          <defs>
            <filter id="cf-protanopia" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0.478897 0.476911 0.044192 0 0  0.597282 -0.688692 1.09141 0 0  0 0 0 1 0" />
            </filter>
            <filter id="cf-deuteranopia" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0.16279 0.725047 0.112165 0 0  0.454695 -0.645392 1.190697 0 0  0 0 0 1 0" />
            </filter>
            <filter id="cf-tritanopia" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0.741159 -0.407208 0.666049 0 0  0.075098 0.585234 0.339668 0 0  0 0 1 0 0  0 0 0 1 0" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
