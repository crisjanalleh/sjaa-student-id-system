import type { ReactNode } from "react";

const LINE = { borderColor: "var(--line)" };

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block rounded ${className}`} />;
}

export function SkeletonPage({ children, label = "Loading page…" }: { children: ReactNode; label?: string }) {
  return (
    <div className="admin-loading admin-page-enter" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonHeader({ buttons = 1 }: { buttons?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Block className="mb-2 h-6 w-48" />
        <Block className="h-3 w-72 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: buttons }, (_, i) => <Block key={i} className="h-9 w-32 !rounded-lg" />)}
      </div>
    </div>
  );
}

export function SkeletonFilters({ fields = 4 }: { fields?: number }) {
  return (
    <section className="card mb-5 animate-pulse p-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i}>
            <Block className="mb-2 h-2.5 w-16" />
            <Block className="h-9 w-full !rounded-lg" />
          </div>
        ))}
        <div className="flex gap-2">
          <Block className="h-9 w-24 !rounded-lg" />
          <Block className="h-9 w-16 !rounded-lg" />
        </div>
      </div>
    </section>
  );
}

export function SkeletonPager() {
  return (
    <div className="flex items-center justify-center gap-4 border-t px-4 py-3" style={LINE}>
      <Block className="h-8 w-8 !rounded-lg" />
      <Block className="h-3 w-40" />
      <Block className="h-8 w-8 !rounded-lg" />
    </div>
  );
}

export function SkeletonList({ rows = 8, title = true, pager = true, avatar = true }: { rows?: number; title?: boolean; pager?: boolean; avatar?: boolean }) {
  return (
    <section className="card animate-pulse overflow-hidden">
      {title && (
        <div className="flex items-center justify-between border-b px-4 py-3" style={LINE}>
          <Block className="h-4 w-36" />
          <Block className="h-3 w-20" />
        </div>
      )}
      <div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" style={LINE}>
            {avatar && <Block className="h-9 w-9 shrink-0 !rounded-full" />}
            <div className="min-w-0 flex-1">
              <Block className="mb-2 h-3.5 w-1/3" />
              <Block className="h-2.5 w-1/2" />
            </div>
            <Block className="hidden h-6 w-20 !rounded-full sm:block" />
          </div>
        ))}
      </div>
      {pager && <SkeletonPager />}
    </section>
  );
}

export function SkeletonFormCard({ fields = 4, button = true }: { fields?: number; button?: boolean }) {
  return (
    <section className="card animate-pulse p-5">
      <Block className="mb-4 h-4 w-40" />
      <div className="space-y-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i}>
            <Block className="mb-2 h-2.5 w-24" />
            <Block className="h-10 w-full !rounded-lg" />
          </div>
        ))}
      </div>
      {button && <Block className="mt-5 h-10 w-full !rounded-lg" />}
    </section>
  );
}

export function SkeletonCardPreview({ ratio = "aspect-[5/8]" }: { ratio?: string }) {
  return (
    <section className="card animate-pulse p-5">
      <Block className="mb-4 h-4 w-32" />
      <div className={`skeleton-block mx-auto w-full max-w-[260px] !rounded-xl ${ratio}`} />
    </section>
  );
}
