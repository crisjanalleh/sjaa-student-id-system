export default function PrintBatchLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading print batch…</span>
      <div className="card mb-6 flex items-center gap-4 p-4">
        <div className="skeleton-block h-9 w-24 animate-pulse rounded-lg" />
        <div className="skeleton-block h-4 flex-1 animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="card aspect-[1.59] animate-pulse" />
        ))}
      </div>
    </main>
  );
}
