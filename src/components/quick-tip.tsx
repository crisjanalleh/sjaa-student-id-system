import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

/** A short, scannable note for steps where an administrator may hesitate. Keep to 2-3 bullets. */
export default function QuickTip({
  title = "Quick tip",
  items,
  className = "",
}: {
  title?: string;
  items: ReactNode[];
  className?: string;
}) {
  return (
    <aside className={`quick-tip ${className}`} aria-label={title}>
      <Lightbulb className="quick-tip-icon" aria-hidden />
      <div>
        <p className="quick-tip-title">{title}</p>
        <ul className="quick-tip-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
