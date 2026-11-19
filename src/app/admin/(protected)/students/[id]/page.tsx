import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  History,
  UserRound,
} from "lucide-react";
import { updateStudentAction } from "@/app/admin/actions";
import { StudentForm } from "@/components/student-form";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { getStudentState } from "@/lib/booking";
import { getStudentById } from "@/lib/students";
import { getSettings } from "@/lib/settings";
import { formatQueue, formatShortDate, formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit student",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireSession();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const student = await getStudentById(id);
  if (!student) notFound();

  const search = await searchParams;
  const saved = first(search.saved);
  const errorMessage = first(search.error);
  const state = await getStudentState(student.id);
  const recent = state.appointments.slice(0, 6);
  const settings = await getSettings();
  const archived = student.schoolYear !== settings.activeSchoolYear;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to students
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <UserRound className="h-6 w-6 text-indigo-500" />
          {student.fullName}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {student.studentNo} · {student.program} ·{" "}
          {student.campus === "SAMAL" ? "SAMAL campus" : "Main campus"} · SY{" "}
          {student.schoolYear || "unknown"}
        </p>
      </div>

      {archived && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <History className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This student belongs to school year {student.schoolYear} and cannot
            book new appointments. Their history is kept for reference.
          </span>
        </div>
      )}

      {saved && (
        <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {saved === "created"
              ? "Student added to the roster."
              : "Student record updated."}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <StudentForm
          action={updateStudentAction}
          student={student}
          submitLabel="Save changes"
          cancelHref="/admin/students"
        />

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Appointment history
              </h2>
            </div>

            <ul className="mt-3 space-y-2.5">
              {recent.map((appointment) => (
                <li
                  key={appointment.id}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      {formatShortDate(appointment.date)} · Queue{" "}
                      {formatQueue(appointment.queueNumber)}
                    </span>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {appointment.referenceCode}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Booked {formatTimestamp(appointment.bookedAt)}
                  </p>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="text-xs text-slate-500">No appointments yet.</li>
              )}
            </ul>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                {state.noShowCount === 0
                  ? "No no-shows on record."
                  : `${state.noShowCount} no-show${
                      state.noShowCount === 1 ? "" : "s"
                    } on record.`}
              </p>
              <Link
                href={`/admin/appointments?q=${encodeURIComponent(
                  student.studentNo,
                )}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View in appointments
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
