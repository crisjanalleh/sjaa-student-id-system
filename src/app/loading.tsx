export default function PageLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page…</span>
      <div className="skeleton-block mb-6 h-8 w-64 animate-pulse rounded-lg" />
      <section className="card space-y-5 p-6">
        <div className="skeleton-block h-4 w-1/2 animate-pulse rounded" />
        <div className="skeleton-block h-11 animate-pulse rounded-lg" />
        <div className="skeleton-block h-4 w-1/3 animate-pulse rounded" />
        <div className="skeleton-block h-11 animate-pulse rounded-lg" />
        <div className="skeleton-block h-12 w-40 animate-pulse rounded-lg" />
      </section>
    </main>
  );
}
