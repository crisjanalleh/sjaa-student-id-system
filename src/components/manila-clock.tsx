"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

const formatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function format(date: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.month} ${parts.day}, ${parts.year} · ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()} PHT`;
}

/** Philippine time (Asia/Manila), refreshed on the minute boundary. Rendered after mount to avoid hydration mismatches. */
export default function ManilaClock() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();
      setLabel(format(now));
      timer = setTimeout(tick, 60000 - (now.getTime() % 60000) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="admin-clock" title="Philippine Time (Asia/Manila, UTC+8)">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span aria-live="off">{label || "\u00a0"}</span>
    </span>
  );
}
