"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import type {
  RosterImportSummary,
  RosterPreview,
} from "@/lib/roster-import";

type Pending = "preview" | "apply" | null;

type RosterResponse = {
  ok: boolean;
  message?: string;
  filename?: string;
  preview?: RosterPreview;
  summary?: RosterImportSummary;
};

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warning" | "danger" | "good";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-700"
      : tone === "danger"
        ? "text-rose-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export function RosterImportForm({
  suggestedYear,
  activeSchoolYear,
}: {
  suggestedYear: string;
  activeSchoolYear: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [schoolYear, setSchoolYear] = useState(suggestedYear);
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [summary, setSummary] = useState<RosterImportSummary | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");

  function resetPreview() {
    setPreview(null);
    setSummary(null);
    setAcknowledged(false);
    setError("");
  }

  async function send(path: string): Promise<RosterResponse | null> {
    if (!file) {
      setError("Choose an .xlsx roster file first.");
      return null;
    }

    const body = new FormData();
    body.set("file", file);
    body.set("schoolYear", schoolYear);

    try {
      const response = await fetch(path, { method: "POST", body });
      const data = (await response.json()) as RosterResponse;
      if (!response.ok && !data.message) {
        return {
          ok: false,
          message: "The request failed. Check the file and try again.",
        };
      }
      return data;
    } catch {
      return {
        ok: false,
        message: "Could not reach the server. Try again in a moment.",
      };
    }
  }

  async function handlePreview() {
    setPending("preview");
    resetPreview();
    const data = await send("/api/admin/roster/preview");
    setPending(null);
    if (!data) return;
    if (!data.ok) {
      setError(data.message ?? "The workbook could not be read.");
      return;
    }
    setFilename(data.filename ?? file?.name ?? "");
    setPreview(data.preview ?? null);
  }

  async function handleApply() {
    if (!preview?.canApply || !acknowledged) return;
    setPending("apply");
    setError("");
    const data = await send("/api/admin/roster/apply");
    setPending(null);
    if (!data) return;
    if (!data.ok || !data.summary) {
      setError(data.message ?? "The import failed and nothing was changed.");
      if (data.preview) setPreview(data.preview);
      return;
    }
    setSummary(data.summary);
    setPreview(null);
    setFile(null);
    setFilename("");
    setAcknowledged(false);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-sm font-semibold">
              {summary.schoolYear} roster imported
            </h2>
          </div>
          <p className="mt-1 text-sm text-emerald-800">
            {summary.imported.toLocaleString()} students are now on the active
            roster.
          </p>
          <dl className="mt-4 grid gap-2 text-xs text-emerald-900 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-emerald-700">Archived with history</dt>
              <dd className="text-base font-bold">{summary.archived}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Deleted (no history)</dt>
              <dd className="text-base font-bold">{summary.deleted}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Bookings cancelled</dt>
              <dd className="text-base font-bold">{summary.cancelledBookings}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Blank rows skipped</dt>
              <dd className="text-base font-bold">{summary.skipped}</dd>
            </div>
          </dl>
          <a
            href="/admin/students"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-800 underline underline-offset-2"
          >
            View the new roster
          </a>
        </div>
      )}

      <form
        className="card p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handlePreview();
        }}
      >
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900">
            Upload the new roster
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          The active roster is currently {activeSchoolYear}. Importing replaces
          it with the new school year.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="schoolYear">
              School year
            </label>
            <input
              id="schoolYear"
              value={schoolYear}
              onChange={(event) => {
                setSchoolYear(event.target.value);
                resetPreview();
              }}
              placeholder="2027-2028"
              className="input"
              pattern="\d{4}-\d{4}"
              title="Use YYYY-YYYY, for example 2027-2028"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Student IDs must start with the same year.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="rosterFile">
              Roster workbook
            </label>
            <input
              ref={fileInput}
              id="rosterFile"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setFilename(selected?.name ?? "");
                resetPreview();
              }}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              .xlsx only, up to 10 MB. The file is checked before anything is
              written.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={`/api/admin/roster/template?year=${encodeURIComponent(schoolYear)}`}
            className="btn-secondary sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Download template
          </a>
          <button
            type="submit"
            className="btn-primary sm:w-auto"
            disabled={pending !== null || !file}
          >
            {pending === "preview" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Preview import
          </button>
        </div>
      </form>

      {preview && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {preview.canApply ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-500" />
              )}
              <h2 className="text-sm font-semibold text-slate-900">
                {preview.canApply
                  ? "Ready to import"
                  : "This file cannot be imported yet"}
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              {filename || file?.name} · {preview.schoolYear}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Valid students" value={preview.validRows} tone="good" />
            <Stat label="New students" value={preview.newStudents} />
            <Stat label="Updated records" value={preview.updatedStudents} />
            <Stat label="Blank rows" value={preview.blankRows} />
            <Stat
              label="Outgoing cohort"
              value={preview.outgoingStudents}
              tone="warning"
            />
            <Stat
              label="Keep with history"
              value={preview.outgoingWithHistory}
              tone="warning"
            />
            <Stat
              label="Delete (no history)"
              value={preview.outgoingWithoutHistory}
              tone="danger"
            />
            <Stat
              label="Bookings cancelled"
              value={preview.outstandingBookings}
              tone="danger"
            />
          </div>

          {preview.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {preview.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                {preview.errors.length} row problem
                {preview.errors.length === 1 ? "" : "s"}
              </h3>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/50">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-rose-100/80 text-rose-800">
                    <tr>
                      <th className="w-16 px-3 py-2 font-semibold">Row</th>
                      <th className="px-3 py-2 font-semibold">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.slice(0, 200).map((item, index) => (
                      <tr
                        key={`${item.row}-${index}`}
                        className="border-t border-rose-100"
                      >
                        <td className="px-3 py-2 font-mono text-rose-700">
                          {item.row === 0 ? "—" : item.row}
                        </td>
                        <td className="px-3 py-2 text-rose-900">
                          {item.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.errors.length > 200 && (
                <p className="mt-2 text-xs text-rose-700">
                  Showing the first 200 problems. Fix these and preview again.
                </p>
              )}
            </div>
          )}

          {preview.canApply && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  I understand this replaces the active {activeSchoolYear}{" "}
                  roster. Outstanding bookings for students who are not in the
                  new file will be cancelled, and records without appointment
                  history will be deleted.
                </span>
              </label>

              <button
                type="button"
                onClick={() => void handleApply()}
                className="btn-primary mt-4 w-full sm:w-auto"
                disabled={!acknowledged || pending !== null}
              >
                {pending === "apply" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import {preview.validRows.toLocaleString()} students
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
