import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/** Native select (keeps accessibility and mobile pickers) with an inset chevron that flips while open. */
export default function SelectField({
  wrapperClassName = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <span className={`select-field ${wrapperClassName}`}>
      <select {...props}>{children}</select>
      <ChevronDown className="select-chevron" aria-hidden />
    </span>
  );
}
