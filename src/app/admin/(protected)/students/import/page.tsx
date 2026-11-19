import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { RosterImportForm } from "@/components/roster-import-form";
import { requireSession } from "@/lib/auth";
import { listRosterImports, ROSTER_COLUMNS } from "@/lib/roster-import";
import { getSettings } from "@/lib/settings";
import { formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import roster",
};

function nextSchoolYear(year: string): string {
  const start = Number.parseInt(year.slice(0, 4), 10);
  if (!Number.isFinite(start)) return year;
  return `${start + 1}-${start + 2}`;
}

export default async function ImportRosterPage() {
  const session = await requireSession();

  if (session.role !== "super_admin") {
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Import roster
          </h1>
        </div>
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Only a super admin can replace the school-year roster. Ask a super
            admin if you need a roster imported.
          </span>
        </div>
      </div>
    );
  }

  const [settings, imports] = await Promise.all([
    getSettings(),
    listRosterImports(10),
  ]);

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
          <FileSpreadsheet className="h-6 w-6 text-indigo-500" />
          Import roster
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Replace the active roster with a new school year. Previous years stay
          available as history.
        </p>
      </div>

      <RosterImportForm
        activeSchoolYear={settings.activeSchoolYear}
        suggestedYear={nextSchoolYear(settings.activeSchoolYear)}
      />

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Template columns
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          One sheet named <span className="font-mono text-xs">ROSTER</span>.
          Headers go in row 1 and students start in row 2. Headers are matched
          by name, so column order can change. Optional columns may be left
          blank.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="data-table">
            <thead>
              <tr>
                <th>Header</th>
                <th>Required</th>
                <th>Rules</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {ROSTER_COLUMNS.map((column) => (
                <tr key={column.key}>
                  <td className="font-semibold text-slate-900">
                    {column.header}
                  </td>
                  <td>
                    <span
                      className={
                        column.required
                          ? "badge bg-rose-100 text-rose-700"
                          : "badge bg-slate-100 text-slate-600"
                      }
                    >
                      {column.required ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="text-sm text-slate-600">
                    {column.key === "studentNo"
                      ? "YYYY-NNNNN, first four digits match the school year"
                      : column.key === "firstName" || column.key === "lastName"
                        ? "1–80 characters"
                        : column.key === "middleInitial"
                          ? "Up to 5 characters"
                          : column.key === "program"
                            ? "Program code, up to 40 characters"
                            : column.key === "yearLevel"
                              ? "Must be 1 when filled in"
                              : column.key === "campus"
                                ? "MAIN or SAMAL"
                                : "Must match the school year in the form"}
                  </td>
                  <td className="font-mono text-xs text-slate-500">
                    {column.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Recent imports
        </h2>
        {imports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No roster has been imported through the app yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>School year</th>
                  <th>File</th>
                  <th>Admin</th>
                  <th>Imported</th>
                  <th>Archived</th>
                  <th>Deleted</th>
                  <th>Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {formatTimestamp(item.createdAt)}
                    </td>
                    <td className="whitespace-nowrap text-sm font-semibold text-slate-900">
                      {item.schoolYear}
                    </td>
                    <td className="max-w-56 truncate text-xs text-slate-600">
                      {item.filename}
                    </td>
                    <td className="text-xs text-slate-600">
                      {item.adminName ?? "CLI import"}
                    </td>
                    <td className="text-sm">{item.imported.toLocaleString()}</td>
                    <td className="text-sm">{item.archived.toLocaleString()}</td>
                    <td className="text-sm">{item.deleted.toLocaleString()}</td>
                    <td className="text-sm">
                      {item.cancelledBookings.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
