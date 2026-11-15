"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  IdCard,
  Loader2,
  Search,
  Ticket,
} from "lucide-react";
import type { LookupResponse, PublicAppointment } from "@/lib/api-types";

type Tab = "code" | "student";

export function LookupForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("code");
  const [code, setCode] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canBook, setCanBook] = useState(false);

  function resetMessages() {
    setError(null);
    setNotice(null);
    setCanBook(false);
  }

  async function handleCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    resetMessages();

    try {
      const response = await fetch(
        `/api/appointment?code=${encodeURIComponent(code)}`,
      );
      const payload = (await response.json()) as
        | { appointment: PublicAppointment }
        | { error: string; message: string };

      if (!response.ok || !("appointment" in payload)) {
        setError(
          "message" in payload
            ? payload.message
            : "We could not find that reference code.",
        );
        return;
      }

      router.push(`/confirmation/${payload.appointment.referenceCode}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    resetMessages();

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo, lastName }),
      });
      const payload = (await response.json()) as
        | LookupResponse
        | { error: string; message: string };

      if (!response.ok || "error" in payload) {
        setError(
          "message" in payload
            ? payload.message
            : "We could not find that record.",
        );
        return;
      }

      const appointment =
        payload.state.active ?? payload.state.verifiedAppointment;

      if (appointment) {
        router.push(`/confirmation/${appointment.referenceCode}`);
        return;
      }

      setNotice(payload.state.message);
      setCanBook(payload.state.canBook);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setTab("code");
            resetMessages();
          }}
          className={
            tab === "code"
              ? "flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
              : "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          }
        >
          <Ticket className="h-4 w-4" />
          Reference code
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("student");
            resetMessages();
          }}
          className={
            tab === "student"
              ? "flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
              : "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          }
        >
          <IdCard className="h-4 w-4" />
          Student ID
        </button>
      </div>

      {tab === "code" ? (
        <form onSubmit={handleCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="code">
              Reference code
            </label>
            <input
              id="code"
              className="input font-mono uppercase tracking-wide"
              placeholder="SDSD-ABC123"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              It is on your appointment pass, for example SDSD-ABC123.
            </p>
          </div>

          {error && (
            <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Looking up…" : "Find my appointment"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleStudent} className="space-y-4">
          <div>
            <label className="label" htmlFor="lookupStudentNo">
              Student ID
            </label>
            <input
              id="lookupStudentNo"
              className="input"
              placeholder="2026-00001"
              value={studentNo}
              onChange={(event) => setStudentNo(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              pattern="\d{4}-?\d{5}"
              title="Format: YYYY-NNNNN (e.g. 2026-00001)"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="lookupLastName">
              Last name
            </label>
            <input
              id="lookupLastName"
              className="input"
              placeholder="Dela Cruz"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              required
            />
          </div>

          {error && (
            <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
              <p>{notice}</p>
              {canBook && (
                <Link
                  href="/book"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Book a slot now
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Looking up…" : "Find my record"}
          </button>
        </form>
      )}
    </div>
  );
}
