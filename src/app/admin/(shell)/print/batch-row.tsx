"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ClickableRow from "@/components/clickable-row";
import { DetailModal } from "@/components/print-progress/print-progress-dock";

/** A batch row: click anywhere to see its print progress; the Print button stays separate. */
export default function BatchRow({ batchId, code, children }: { batchId: number; code: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ClickableRow label={`View print progress for batch ${code}`} onActivate={() => setOpen(true)}>
        {children}
      </ClickableRow>
      {open && createPortal(<DetailModal batchId={batchId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
