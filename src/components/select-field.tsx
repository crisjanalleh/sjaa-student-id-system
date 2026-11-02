"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

type Option = { value: string; label: string; disabled: boolean };

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function collectOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return;
      if (child.type === "option") {
        const label = textOf(child.props.children);
        out.push({
          value: child.props.value !== undefined ? String(child.props.value) : label,
          label,
          disabled: Boolean(child.props.disabled),
        });
      } else if (child.props.children) {
        walk(child.props.children);
      }
    });
  };
  walk(children);
  return out;
}

/**
 * Drop-in replacement for a native select: a styled listbox popover with keyboard support.
 * A hidden native select stays in the DOM, so plain form submits, `name`, `defaultValue`,
 * controlled `value` and `onChange` all keep working unchanged.
 */
export default function SelectField({
  wrapperClassName = "",
  children,
  className = "inp",
  id,
  value,
  defaultValue,
  disabled,
  onChange,
  name,
  required,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  const options = collectOptions(children);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [inner, setInner] = useState(() => String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, up: false, max: 280 });

  const selected = options.find((o) => o.value === current);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === current));

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 200 && above > below;
    const max = Math.max(140, Math.min(280, up ? above : below));
    setBox({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up, max });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    if (disabled) return;
    setActive(selectedIndex);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    if (option.value === current) return;
    setInner(option.value);
    const native = nativeRef.current;
    if (native) {
      native.value = option.value;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function step(from: number, dir: 1 | -1) {
    let i = from;
    for (let n = 0; n < options.length; n += 1) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => step(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => step(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(step(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(step(options.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      const letter = e.key.toLowerCase();
      const next = options.findIndex((o, i) => i > active && !o.disabled && o.label.toLowerCase().startsWith(letter));
      const wrap = next >= 0 ? next : options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(letter));
      if (wrap >= 0) setActive(wrap);
    }
  }

  const placeholder = !selected || selected.value === "";

  return (
    <span className={`select-field ${wrapperClassName}`}>
      <select
        ref={nativeRef}
        className="select-native"
        name={name}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        value={current}
        onChange={onChange ?? (() => {})}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`${className} select-trigger`}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        data-open={open ? "true" : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value ${placeholder ? "is-placeholder" : ""}`}>{selected?.label || "Select…"}</span>
        <ChevronDown className="select-chevron" aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            className={`select-pop ${box.up ? "is-up" : ""}`}
            style={{
              left: box.left,
              width: Math.max(box.width, 160),
              maxHeight: box.max,
              ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }),
            }}
          >
            {options.map((o, i) => (
              <div
                key={`${o.value}-${i}`}
                role="option"
                data-index={i}
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                className={`select-opt ${i === active ? "is-active" : ""} ${o.value === current ? "is-selected" : ""}`}
                onPointerEnter={() => !o.disabled && setActive(i)}
                onClick={() => commit(i)}
              >
                <span className="select-opt-label">{o.label || "\u00a0"}</span>
                {o.value === current && <Check className="select-opt-check" aria-hidden />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
