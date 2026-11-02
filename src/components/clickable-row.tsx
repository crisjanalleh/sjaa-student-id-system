"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

const INTERACTIVE = "a, button, input, select, textarea, label, [data-row-ignore]";

/**
 * A table row that opens its record when clicked anywhere. Real links and buttons inside the row
 * keep their own behaviour, and the row stays reachable by keyboard.
 */
export default function ClickableRow({
  href,
  onActivate,
  label,
  className = "",
  children,
}: {
  href?: string;
  onActivate?: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const activate = () => {
    if (onActivate) onActivate();
    else if (href) router.push(href);
  };
  return (
    <tr
      className={`row-click ${className}`}
      tabIndex={0}
      role="link"
      aria-label={label}
      onMouseEnter={href ? () => router.prefetch(href) : undefined}
      onClick={(event: MouseEvent<HTMLTableRowElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        activate();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      {children}
    </tr>
  );
}
