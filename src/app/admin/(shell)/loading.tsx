export default function AdminLoading() {
  return (
    <div className="admin-loading admin-page-enter" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading administration page…</span>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="skeleton-block mb-2 h-6 w-48 rounded" />
          <div className="skeleton-block h-3 w-72 max-w-full rounded" />
        </div>
        <div className="skeleton-block h-9 w-36 rounded-lg" />
      </div>
      <section className="card mb-6 animate-pulse overflow-hidden p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--line)" }}>
          <div>
            <div className="skeleton-block mb-2 h-4 w-40 rounded" />
            <div className="skeleton-block h-3 w-60 rounded" />
          </div>
          <div className="flex gap-5">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <div className="skeleton-block mb-2 h-2.5 w-20 rounded" />
                <div className="skeleton-block h-6 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="skeleton-block mb-4 h-3 w-full rounded-full" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="card h-28 animate-pulse p-3">
              <div className="skeleton-block mb-4 h-3 w-10 rounded" />
              <div className="skeleton-block mb-3 h-7 w-12 rounded" />
              <div className="skeleton-block h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card animate-pulse lg:col-span-2">
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
            <div className="skeleton-block h-4 w-36 rounded" />
          </div>
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton-block h-8 rounded" />)}
          </div>
        </section>
        <section className="card animate-pulse p-4">
          <div className="skeleton-block mb-4 h-4 w-32 rounded" />
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton-block h-10 rounded" />)}
          </div>
        </section>
      </div>
    </div>
  );
}
