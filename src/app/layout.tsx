import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SJAA Student ID Issuance System",
    template: "%s · SJAA ID System",
  },
  description:
    "San Jose Adventist Academy — Web-Based Student ID Issuance System with QR Code Access and Automated Template Generation.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('sjaa-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}else{document.documentElement.removeAttribute('data-theme');}}catch(e){document.documentElement.removeAttribute('data-theme');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
