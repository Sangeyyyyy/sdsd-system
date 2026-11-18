"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error
      ? (error as Error & { digest?: string }).digest
      : undefined;

  return (
    <div className="card mx-auto max-w-lg p-6 text-center sm:p-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">
        This page could not load
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        The database or server did not respond. Your data was not changed. Try
        again in a moment.
      </p>
      {digest && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
          Reference: {digest}
        </p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="btn-primary mx-auto mt-5"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
