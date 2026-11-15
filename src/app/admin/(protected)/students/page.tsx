import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Search, Users } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { countStudents, listStudents } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatQueue, formatShortDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Students",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = first(params.q);
  const page = Math.max(1, Number.parseInt(first(params.page) || "1", 10) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const [students, total, settings] = await Promise.all([
    listStudents(query, pageSize, offset),
    countStudents(query),
    getSettings(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (nextPage > 1) search.set("page", String(nextPage));
    const suffix = search.toString();
    return `/admin/students${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Students
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Search the first-year roster. {total.toLocaleString()} record
          {total === 1 ? "" : "s"}
          {query ? " matched" : " total"}.
        </p>
      </div>

      <form method="get" action="/admin/students" className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search by name, Student ID, or program"
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-primary sm:w-40">
            <Search className="h-4 w-4" />
            Search
          </button>
          {query && (
            <Link href="/admin/students" className="btn-ghost sm:w-auto">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Student ID</th>
              <th>Program</th>
              <th>Campus</th>
              <th>Latest status</th>
              <th>Active booking</th>
              <th className="w-28">Open</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>
                  <p className="font-semibold text-slate-900">
                    {student.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {student.noShowCount === 0
                      ? "No rebookings"
                      : student.noShowCount > settings.maxRebooks
                        ? "Rebook limit reached"
                        : `${student.noShowCount} of ${settings.maxRebooks} rebookings used`}
                  </p>
                </td>
                <td className="font-mono text-xs text-slate-700">
                  {student.studentNo}
                </td>
                <td className="text-sm">{student.program}</td>
                <td>
                  <span
                    className={
                      student.campus === "SAMAL"
                        ? "badge bg-amber-100 text-amber-800"
                        : "badge bg-slate-100 text-slate-600"
                    }
                  >
                    {student.campus === "SAMAL" ? "SAMAL" : "Main"}
                  </span>
                </td>
                <td>
                  {student.lastStatus ? (
                    <StatusBadge status={student.lastStatus} />
                  ) : (
                    <span className="text-xs text-slate-500">No appointment</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-xs text-slate-600">
                  {student.bookedDate ? (
                    <>
                      <span className="font-semibold text-slate-800">
                        {formatShortDate(student.bookedDate)}
                      </span>
                      {student.bookedQueue !== null && (
                        <span className="ml-1.5 font-mono text-slate-500">
                          #{formatQueue(student.bookedQueue)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/appointments?q=${encodeURIComponent(
                      student.studentNo,
                    )}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}

            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Users className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    No students matched your search.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try a shorter name, a Student ID, or a program code.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {total === 0 ? 0 : offset + 1}–
          {Math.min(offset + pageSize, total)} of {total.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Previous
            </Link>
          )}
          <span className="px-2 py-1.5">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageHref(page + 1)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
