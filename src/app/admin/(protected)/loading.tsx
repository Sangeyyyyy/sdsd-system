export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card h-20 animate-pulse bg-slate-50" />
        ))}
      </div>

      <div className="card h-72 animate-pulse bg-slate-50" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
