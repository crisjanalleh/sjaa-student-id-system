"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Snapchat|TikTok|Twitter|MicroMessenger|; wv\)/i;

/**
 * Social apps open links in their own embedded browser, which a page cannot
 * leave by itself. Android can be sent to the default browser via an intent
 * link; elsewhere we explain how to open it in the real browser.
 */
export default function OpenInBrowserBanner() {
  const [state, setState] = useState<{ intent: string | null } | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (!IN_APP.test(ua)) return;
    const android = /Android/i.test(ua);
    const url = new URL(window.location.href);
    const intent = android
      ? `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};end`
      : null;
    // Defer so the banner appears after hydration without a synchronous state update in the effect body.
    const timer = window.setTimeout(() => setState({ intent }), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!state) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-xs" style={{ borderColor: "var(--accent-gold)", background: "var(--card)" }} role="note">
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        For the best experience (especially the signature pad), open this form in your phone&apos;s browser such as Chrome or Safari.
        {state.intent ? "" : " Tap the ⋯ or share menu and choose “Open in browser”."}
      </p>
      {state.intent && (
        <a href={state.intent} className="btn btn-gold btn-sm">
          Open in browser
        </a>
      )}
    </div>
  );
}
