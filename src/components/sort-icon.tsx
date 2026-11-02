type Props = { active?: boolean; dir?: "asc" | "desc"; className?: string };

/**
 * The one sort indicator every sort / order control uses: a filled down-triangle (▼).
 * Descending points down, ascending points up. It always sits after the label, flips
 * into place when the order changes, and nudges on hover (see `.sort-icon` in globals.css).
 */
export default function SortIcon({ active = false, dir = "desc", className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 10 10"
      className={`sort-icon ${dir === "asc" ? "is-asc" : "is-desc"} ${active ? "is-active" : ""} ${className}`}
      aria-hidden
      focusable="false"
    >
      <path d="M1.2 3 H8.8 L5 8 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
