export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span
          aria-hidden
          className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
        />
        <p className="text-sm font-medium">Loading…</p>
        <span className="sr-only">Loading page</span>
      </div>
    </div>
  );
}
