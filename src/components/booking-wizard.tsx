"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  IdCard,
  Loader2,
  MapPin,
  Printer,
  Search,
  Ticket,
  UserCheck,
} from "lucide-react";
import { formatLongDate, formatQueue } from "@/lib/dates";
import type {
  BookResponse,
  LookupResponse,
  PublicAppointment,
} from "@/lib/api-types";

type Step = "lookup" | "confirm" | "success" | "notice";

function CampusBadge({ campus }: { campus: string }) {
  const isSamal = campus.toUpperCase() === "SAMAL";
  return (
    <span
      className={
        isSamal
          ? "badge bg-amber-100 text-amber-800"
          : "badge bg-slate-100 text-slate-700"
      }
    >
      <MapPin className="h-3 w-3" />
      {isSamal ? "SAMAL campus" : "Main campus"}
    </span>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function StepPills({ step }: { step: Step }) {
  const steps = ["Find your record", "Confirm your name", "Get your number"];
  // Only the real success path shows completed steps; the "already booked"
  // and blocked paths keep step 1 active so nothing is falsely checked.
  const activeIndex =
    step === "confirm" ? 1 : step === "success" ? 2 : 0;
  const showChecks = step === "success";
  return (
    <ol className="mb-6 flex flex-wrap gap-2 text-xs font-medium">
      {steps.map((label, index) => (
        <li
          key={label}
          className={
            index === activeIndex
              ? "flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-white"
              : showChecks && index < activeIndex
                ? "flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700"
                : "flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600"
          }
        >
          {showChecks && index < activeIndex ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <span
              className={
                index === activeIndex
                  ? "flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-[10px] text-white"
                  : "flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-600"
              }
            >
              {index + 1}
            </span>
          )}
          {label}
        </li>
      ))}
    </ol>
  );
}

export function BookingWizard() {
  const [step, setStep] = useState<Step>("lookup");
  const [studentNo, setStudentNo] = useState("");
  const [lastName, setLastName] = useState("");
  const [data, setData] = useState<LookupResponse | null>(null);
  const [appointment, setAppointment] = useState<PublicAppointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [consent, setConsent] = useState(false);

  function reset() {
    setStep("lookup");
    setData(null);
    setAppointment(null);
    setError(null);
    setCopied(false);
    setConsent(false);
  }

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

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
            : "We could not find your record. Please check and try again.",
        );
        return;
      }

      setData(payload);
      if (payload.state.canBook) {
        setStep("confirm");
      } else {
        setAppointment(
          payload.state.active ?? payload.state.verifiedAppointment ?? null,
        );
        setStep("notice");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo, lastName, consent }),
      });
      const payload = (await response.json()) as BookResponse;

      if (!response.ok || !payload.ok) {
        setError(
          "message" in payload
            ? payload.message
            : "We could not save your booking. Please try again.",
        );
        return;
      }

      setAppointment(payload.appointment);
      setStep("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyReference() {
    if (!appointment) return;
    try {
      await navigator.clipboard.writeText(appointment.referenceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <StepPills step={step} />

      {step === "lookup" && (
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="label" htmlFor="studentNo">
              Student ID
            </label>
            <div className="relative">
              <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="studentNo"
                className="input pl-9"
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
            <p className="mt-1.5 text-xs text-slate-500">
              Format: YYYY-NNNNN. It is printed on your school ID.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="lastName">
              Last name
            </label>
            <div className="relative">
              <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="lastName"
                className="input pl-9"
                placeholder="Dela Cruz"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Looking up your record…" : "Find my record"}
          </button>
        </form>
      )}

      {step === "confirm" && data && (
        <div>
          <p className="text-sm text-slate-600">
            We found your record. Please confirm that this is really you.
          </p>

          {data.state.nextAvailableDate && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-sm text-emerald-900">
              <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                You&apos;ll be assigned the earliest open office day —
                currently{" "}
                <strong className="font-semibold">
                  {formatLongDate(data.state.nextAvailableDate)}
                </strong>
                .
              </p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
              Full name
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {data.student.fullName}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Student ID" value={data.student.studentNo} />
              <Detail label="Program" value={data.student.program} />
              <Detail
                label="Campus"
                value={<CampusBadge campus={data.student.campus} />}
              />
              <Detail
                label="Rebookings used"
                value={`${data.state.noShowCount} of ${data.state.maxRebooks}`}
              />
            </div>
          </div>

          {error && <div className="mt-4"><ErrorBox message={error} /></div>}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-600 transition hover:border-slate-300">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-indigo-600"
            />
            <span>
              I have read and agree to the{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
              >
                Data Privacy Notice
              </Link>
              . I understand that my Student ID, name, program, and appointment
              details will be used to schedule and verify my ID verification.
            </span>
          </label>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary flex-1 py-3"
              disabled={loading || !consent}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
              {loading ? "Booking your slot…" : "Yes, this is me — book my slot"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="btn-secondary"
              disabled={loading}
            >
              Not me
            </button>
          </div>

          {!consent && (
            <p className="mt-2 text-xs text-slate-500">
              Check the privacy agreement above to continue.
            </p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            By confirming, you agree to show up on your assigned date. If you
            cannot attend, you may rebook after a no-show up to{" "}
            {data.state.maxRebooks} times.
          </p>
        </div>
      )}

      {step === "success" && appointment && (
        <div>
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              You&apos;re booked!
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Screenshot this page now. It is your only confirmation.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 border-b border-slate-100 pb-4">
              <Image
                src="/sdsd-logo.png"
                alt="SDSD logo"
                width={224}
                height={256}
                sizes="36px"
                className="h-9 w-9 object-contain"
              />
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">SDSD Q</p>
                <p className="text-[11px] text-slate-500">
                  ID verification pass
                </p>
              </div>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Your queue number
            </p>
            <p className="mt-1 text-6xl font-black tracking-tight text-indigo-600">
              {formatQueue(appointment.queueNumber)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Whole-day queue · not a time slot
            </p>

            <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-left sm:grid-cols-2">
              <Detail
                label="Date"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-indigo-500" />
                    {formatLongDate(appointment.date)}
                  </span>
                }
              />
              <Detail
                label="Reference code"
                value={
                  <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-slate-800">
                    {appointment.referenceCode}
                  </code>
                }
              />
              <Detail label="Student" value={appointment.fullName} />
              <Detail
                label="Program"
                value={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {appointment.program}
                    <CampusBadge campus={appointment.campus} />
                  </span>
                }
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/confirmation/${appointment.referenceCode}`}
              className="btn-primary flex-1"
            >
              <Printer className="h-4 w-4" />
              View / print my pass
            </Link>
            <button type="button" onClick={copyReference} className="btn-secondary">
              <ClipboardCopy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy reference"}
            </button>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
            <Ticket className="mt-0.5 h-4 w-4 shrink-0" />
            Bring your school ID on your appointment day. If you lose this page,
            use your reference code on the Find appointment page.
          </p>
        </div>
      )}

      {step === "notice" && (
        <div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                {data?.state.status === "verified" ? (
                  <BadgeCheck className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {data?.state.status === "booked"
                    ? "You already have an appointment"
                    : data?.state.status === "verified"
                      ? "You are already verified"
                      : "Booking is not available right now"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {data?.state.message}
                </p>
              </div>
            </div>
          </div>

          {appointment && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail
                  label="Date"
                  value={formatLongDate(appointment.date)}
                />
                <Detail
                  label="Queue number"
                  value={formatQueue(appointment.queueNumber)}
                />
                <Detail label="Student" value={appointment.fullName} />
                <Detail
                  label="Reference code"
                  value={
                    <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold">
                      {appointment.referenceCode}
                    </code>
                  }
                />
              </div>
              <Link
                href={`/confirmation/${appointment.referenceCode}`}
                className="btn-primary mt-5 w-full"
              >
                View my pass
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/lookup" className="btn-secondary flex-1">
              <Search className="h-4 w-4" />
              Find another appointment
            </Link>
            <button type="button" onClick={reset} className="btn-secondary">
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
