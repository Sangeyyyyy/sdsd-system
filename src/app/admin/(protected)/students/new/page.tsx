import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Info, UserPlus } from "lucide-react";
import { createStudentAction } from "@/app/admin/actions";
import { StudentForm } from "@/components/student-form";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add student",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSession();
  const params = await searchParams;
  const errorMessage = first(params.error);

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
          <UserPlus className="h-6 w-6 text-indigo-500" />
          Add a student
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Add someone missing from the imported roster, or correct a record that
          was typed incorrectly.
        </p>
      </div>

      {errorMessage && (
        <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <StudentForm
        action={createStudentAction}
        submitLabel="Add student"
        cancelHref="/admin/students"
      />

      <div className="flex gap-2.5 rounded-2xl border border-slate-200 bg-white p-5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          The student can book immediately after being added. Names are matched
          case-insensitively and ignore suffixes like JR and III, so the student
          can type their name naturally on the booking page.
        </p>
      </div>
    </div>
  );
}
