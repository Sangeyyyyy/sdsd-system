"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";

type CancelResponse = {
  ok?: boolean;
  message?: string;
};

export function CancelAppointment({ referenceCode }: { referenceCode: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referenceCode }),
      });
      const data = (await response.json().catch(() => ({}))) as CancelResponse;

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Could not cancel the appointment.");
        setConfirming(false);
        return;
      }

      setDone(true);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="no-print mt-5 flex gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Your appointment has been cancelled. You can book a new slot if one is
          still available.
        </span>
      </div>
    );
  }

  return (
    <div className="no-print mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      {error && (
        <div className="mb-3 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {confirming ? (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Cancel this appointment?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Your queue slot will be released. You can book again from the
            booking page if slots remain, subject to the rebooking limit.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={cancel}
              disabled={loading}
              className="btn-primary bg-rose-600 hover:bg-rose-700 sm:w-auto"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Yes, cancel appointment
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="btn-secondary sm:w-auto"
            >
              Keep appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Can&apos;t make it?
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Cancel so the slot can go to another student.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn-secondary sm:w-auto"
          >
            <XCircle className="h-4 w-4" />
            Cancel appointment
          </button>
        </div>
      )}
    </div>
  );
}
