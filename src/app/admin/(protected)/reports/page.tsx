import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Download,
  Ticket,
  TrendingUp,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getReport, normalizeReportRange } from "@/lib/reports";
import {
  addDays,
  formatShortDate,
  formatWeekday,
  todayISO,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function percent(part: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSession();
  const params = await searchParams;
  const range = normalizeReportRange(first(params.from), first(params.to));
  const report = await getReport(range);
  const summary = report.summary;

  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const presets = [
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: monthStart, to: today },
  ];

  const cards = [
    {
      label: "Appointments",
      value: summary.total.toLocaleString(),
      hint: `${summary.days} active day${summary.days === 1 ? "" : "s"}`,
      icon: Ticket,
      tone: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Verified",
      value: summary.verified.toLocaleString(),
      hint: percent(summary.verified, summary.total) + " of appointments",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "No-shows",
      value: summary.noShow.toLocaleString(),
      hint: percent(summary.noShow, summary.total) + " of appointments",
      icon: UserX,
      tone: "bg-rose-50 text-rose-600",
    },
    {
      label: "Cancelled",
      value: summary.cancelled.toLocaleString(),
      hint: percent(summary.cancelled, summary.total) + " of appointments",
      icon: XCircle,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "Students seen",
      value: summary.students.toLocaleString(),
      hint: "Unique students in range",
      icon: Users,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "Show-up rate",
      value: percent(summary.verified, summary.verified + summary.noShow),
      hint: "Verified ÷ (verified + no-shows)",
      icon: TrendingUp,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  const exportHref = `/api/admin/reports/export?from=${range.from}&to=${range.to}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <BarChart3 className="h-6 w-6 text-indigo-500" />
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatShortDate(range.from)} – {formatShortDate(range.to)} ·{" "}
            {summary.total.toLocaleString()} appointment
            {summary.total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href={exportHref} className="btn-secondary sm:w-auto">
          <Download className="h-4 w-4" />
          Export CSV
        </Link>
      </div>

      <form method="get" action="/admin/reports" className="card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label text-xs" htmlFor="reportFrom">
              From
            </label>
            <input
              id="reportFrom"
              type="date"
              name="from"
              defaultValue={range.from}
              className="input"
            />
          </div>
          <div>
            <label className="label text-xs" htmlFor="reportTo">
              To
            </label>
            <input
              id="reportTo"
              type="date"
              name="to"
              defaultValue={range.to}
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary">
            <CalendarRange className="h-4 w-4" />
            Apply range
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active =
              range.from === preset.from && range.to === preset.to;
            return (
              <Link
                key={preset.label}
                href={`/admin/reports?from=${preset.from}&to=${preset.to}`}
                className={
                  active
                    ? "badge bg-indigo-100 text-indigo-700"
                    : "badge bg-slate-100 text-slate-600 hover:bg-slate-200"
                }
              >
                {preset.label}
              </Link>
            );
          })}
          <span className="ml-auto self-center text-[11px] text-slate-500">
            Up to 366 days per report.
          </span>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="card flex items-center gap-3 p-4">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tone}`}
            >
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight text-slate-900">
                {card.value}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="truncate text-[11px] text-slate-500">{card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Daily activity
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Total</th>
                <th>Booked</th>
                <th>Verified</th>
                <th>No-shows</th>
                <th>Cancelled</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {report.byDay.map((day) => (
                <tr key={day.date}>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold text-slate-900">
                      {formatShortDate(day.date)}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-500">
                      {formatWeekday(day.date)}
                    </span>
                  </td>
                  <td className="text-sm font-semibold text-slate-900">
                    {day.total}
                  </td>
                  <td className="text-sm">{day.booked}</td>
                  <td className="text-sm text-emerald-700">{day.verified}</td>
                  <td className="text-sm text-rose-700">{day.noShow}</td>
                  <td className="text-sm text-slate-500">{day.cancelled}</td>
                  <td className="text-xs text-slate-500">
                    {percent(day.verified, day.verified + day.noShow)}
                  </td>
                </tr>
              ))}
              {report.byDay.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No appointments in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            By program
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Total</th>
                  <th>Verified</th>
                  <th>No-shows</th>
                  <th>Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {report.byProgram.map((group) => (
                  <tr key={group.label}>
                    <td className="text-sm font-semibold text-slate-900">
                      {group.label}
                    </td>
                    <td className="text-sm">{group.total}</td>
                    <td className="text-sm text-emerald-700">
                      {group.verified}
                    </td>
                    <td className="text-sm text-rose-700">{group.noShow}</td>
                    <td className="text-sm text-slate-500">
                      {group.cancelled}
                    </td>
                  </tr>
                ))}
                {report.byProgram.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No data in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            By campus
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Total</th>
                  <th>Verified</th>
                  <th>No-shows</th>
                  <th>Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {report.byCampus.map((group) => (
                  <tr key={group.label}>
                    <td className="text-sm font-semibold text-slate-900">
                      {group.label === "SAMAL" ? "SAMAL" : "Main"}
                    </td>
                    <td className="text-sm">{group.total}</td>
                    <td className="text-sm text-emerald-700">
                      {group.verified}
                    </td>
                    <td className="text-sm text-rose-700">{group.noShow}</td>
                    <td className="text-sm text-slate-500">
                      {group.cancelled}
                    </td>
                  </tr>
                ))}
                {report.byCampus.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No data in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
