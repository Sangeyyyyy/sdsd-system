"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function AppError({
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          The page could not be loaded. This is usually temporary — try again,
          and if it keeps happening contact the SDSD office.
        </p>
        {digest && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
            Reference: {digest}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => retry()} className="btn-primary flex-1">
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className="btn-secondary flex-1">
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
