import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Clock,
  IdCard,
  MapPin,
  Ticket,
} from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { PassQr } from "@/components/pass-qr";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { StatusBadge } from "@/components/status-badge";
import { getAppointmentByReference } from "@/lib/booking";
import { absoluteUrl } from "@/lib/site";
import {
  formatLongDate,
  formatQueue,
  formatTimestamp,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Appointment pass",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const appointment = await getAppointmentByReference(code);

  if (!appointment) notFound();

  const isVerified = appointment.status === "verified";
  const isInactive =
    appointment.status === "no_show" || appointment.status === "cancelled";
  const isSamal = appointment.campus.toUpperCase() === "SAMAL";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Appointment pass
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Show this at the SDSD office on your assigned date.
            </p>
          </div>
          <div className="flex gap-2">
            <PrintButton label="Print pass" />
            <Link href="/lookup" className="btn-ghost">
              Find another
            </Link>
          </div>
        </div>

        {isVerified && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">You are verified.</p>
              <p className="mt-0.5">
                Your ID verification is complete. No further appointment is
                needed.
              </p>
            </div>
          </div>
        )}

        {isInactive && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                This appointment is marked {appointment.status === "no_show" ? "as a no-show" : "cancelled"}.
              </p>
              <p className="mt-0.5">
                You can book a new slot if you still have rebookings left.{" "}
                <Link href="/book" className="font-semibold underline underline-offset-2">
                  Book again
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        <article className="print-surface card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/sdsd-logo.png"
                  alt="SDSD logo"
                  width={224}
                  height={256}
                  sizes="40px"
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    SDSD Q Pass
                  </p>
                  <p className="text-xs text-slate-500">
                    Student Development and Services Division
                  </p>
                </div>
              </div>
              <StatusBadge status={appointment.status} />
            </div>
          </div>

          <div className="px-6 py-7">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Queue number
              </p>
              <p className="mt-1 text-7xl font-black tracking-tight text-indigo-600">
                {formatQueue(appointment.queueNumber)}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Whole-day queue · not a time slot
              </p>
            </div>

            <div className="mt-7 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  {formatLongDate(appointment.date)}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Reference code
                </p>
                <p className="mt-1">
                  <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-slate-800">
                    {appointment.referenceCode}
                  </code>
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Student
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {appointment.fullName}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Student ID
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <IdCard className="h-4 w-4 text-slate-400" />
                  {appointment.studentNo}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Program
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {appointment.program}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Campus
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {isSamal ? "SAMAL campus" : "Main campus"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Booked on
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {formatTimestamp(appointment.bookedAt)}
                </p>
              </div>

              {appointment.verifiedAt && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Verified on
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatTimestamp(appointment.verifiedAt)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-7 flex flex-col items-center gap-2 border-t border-slate-100 pt-6">
              <PassQr
                value={absoluteUrl(
                  `/confirmation/${encodeURIComponent(appointment.referenceCode)}`,
                )}
              />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Scan to open this pass
              </p>
            </div>

            <div className="mt-7 rounded-xl bg-slate-50 px-4 py-3.5">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                Bring your school ID. Arrive during office hours (Monday to
                Thursday). Keep a screenshot of this pass — it is your only
                confirmation.
              </p>
            </div>
          </div>
        </article>

        <div className="no-print mt-5 flex flex-col gap-2 sm:flex-row">
          {appointment.status === "verified" ? (
            <>
              <Link href="/" className="btn-primary flex-1">
                Back to home
              </Link>
              <Link href="/lookup" className="btn-secondary flex-1">
                Find another appointment
              </Link>
            </>
          ) : appointment.status === "booked" ? (
            <>
              <Link href="/lookup" className="btn-secondary flex-1">
                Find another appointment
              </Link>
              <Link href="/" className="btn-secondary flex-1">
                Back to home
              </Link>
            </>
          ) : (
            <>
              <Link href="/book" className="btn-primary flex-1">
                Book a new slot
              </Link>
              <Link href="/lookup" className="btn-secondary flex-1">
                Find another appointment
              </Link>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
