"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

type ListNav = { pending: boolean; go: (href: string) => void };

const ListNavContext = createContext<ListNav | null>(null);

function useOwnNav(): ListNav {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = useCallback(
    (href: string) => startTransition(() => router.push(href, { scroll: false })),
    [router],
  );
  return { pending, go };
}

function useListNav(): ListNav {
  const shared = useContext(ListNavContext);
  const own = useOwnNav();
  return shared ?? own;
}

/**
 * Wraps a list/filter section so filter, sort and page changes are soft
 * navigations: only this section dims and shows a loading indicator while the
 * server renders the new results, instead of reloading the whole page.
 */
export function ListCard({
  children,
  className = "card",
}: {
  children: ReactNode;
  className?: string;
}) {
  const nav = useOwnNav();
  return (
    <ListNavContext.Provider value={nav}>
      <section
        className={`list-card ${className} ${nav.pending ? "list-card-pending" : ""}`}
        aria-busy={nav.pending}
      >
        {nav.pending && (
          <>
            <div className="list-progress" aria-hidden />
            <div className="list-loading" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Updating results…
            </div>
          </>
        )}
        {children}
      </section>
    </ListNavContext.Provider>
  );
}

export function FilterForm({
  action,
  className,
  style,
  children,
}: {
  action: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const { go } = useListNav();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      if (typeof value === "string" && value.trim() && key !== "page") params.set(key, value.trim());
    }
    const qs = params.toString();
    go(qs ? `${action}?${qs}` : action);
  }

  return (
    <form method="GET" action={action} onSubmit={onSubmit} className={className} style={style}>
      {children}
    </form>
  );
}

export function FilterSubmit({
  children,
  className = "btn btn-primary",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useListNav();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ListLink({
  href,
  className,
  style,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const { go } = useListNav();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    go(href);
  };
  return (
    <Link href={href} className={className} style={style} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

/** Icon-only pager: < page details in the middle > */
export function Pager({
  basePath,
  params,
  page,
  totalPages,
  summary,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  summary: string;
}) {
  const { go, pending } = useListNav();
  const hrefFor = (target: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    if (target > 1) qs.set("page", String(target));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const arrow = (enabled: boolean, target: number, label: string, icon: ReactNode) =>
    enabled ? (
      <Link
        href={hrefFor(target)}
        aria-label={label}
        title={label}
        className="pager-btn"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          go(hrefFor(target));
        }}
      >
        {icon}
      </Link>
    ) : (
      <span className="pager-btn" aria-disabled="true" aria-label={label}>
        {icon}
      </span>
    );

  return (
    <nav className="pager" aria-label="Pagination">
      {arrow(hasPrev, page - 1, "Previous page", <ChevronLeft className="h-4 w-4" aria-hidden />)}
      <div className="pager-info" aria-live="polite">
        <strong>
          Page {page} of {totalPages}
        </strong>
        <span>{pending ? "Loading…" : summary}</span>
      </div>
      {arrow(hasNext, page + 1, "Next page", <ChevronRight className="h-4 w-4" aria-hidden />)}
    </nav>
  );
}
