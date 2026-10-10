"use client";

import { Loader2, Printer, TriangleAlert } from "lucide-react";
import { useState } from "react";

export default function PrintButton() {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");

  async function printCards() {
    if (preparing) return;
    setPreparing(true);
    setError("");
    try {
      await document.fonts.ready;
      const images = Array.from(document.querySelectorAll<HTMLImageElement>(".print-page img"));
      await Promise.all(images.map((image) => image.decode()));
      if (images.some((image) => image.naturalWidth === 0)) {
        throw new Error("A card image did not finish loading.");
      }
      window.print();
    } catch {
      setError("Some card images could not load. Check your connection, reload this batch, and try printing again.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn btn-gold btn-sm" onClick={printCards} disabled={preparing}>
        {preparing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
        {preparing ? "Preparing cards…" : "Print cards"}
      </button>
      {error && <span role="alert" className="flex max-w-80 items-center gap-1 text-right text-xs" style={{ color: "var(--danger)" }}>
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />{error}
      </span>}
    </div>
  );
}
