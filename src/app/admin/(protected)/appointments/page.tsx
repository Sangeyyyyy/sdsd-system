import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Download, Filter, Search } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { AppointmentsBoard } from "@/components/appointments-board";
import { countAppointments, getDayStats, listAppointments } from "@/lib/queries";
import { formatLongDate, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Appointments",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const dateParam = first(params.date);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const query = first(params.q);
  const status = first(params.status);
  const campus = first(params.campus);
  const page = Math.max(1, Number.parseInt(first(params.page) || "1", 10) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const errorMessage = first(params.error);

  const [stats, rows, total] = await Promise.all([
    getDayStats(date),
    listAppointments({ date, query, status, campus, limit: pageSize, offset }),
    countAppointments({ date, query, status, campus }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { date, q: query, status, campus };
  const exportHref = `/api/admin/export${buildQuery(baseParams)}`;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatLongDate(date)} · {stats.slotsBooked} of {stats.capacity}{" "}
            slots booked
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={exportHref} className="btn-secondary">
            <Download className="h-4 w-4" />
            Export CSV
          </Link>
          <PrintButton label="Print list" />
        </div>
      </div>

      {errorMessage && (
        <div className="no-print flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form
        method="get"
        action="/admin/appointments"
        className="no-print card p-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.9fr_1.3fr_0.9fr_0.9fr_auto]">
          <div>
            <label className="label text-xs" htmlFor="filterDate">
              Date
            </label>
            <input
              id="filterDate"
              type="date"
              name="date"
              defaultValue={date}
              className="input"
            />
          </div>
          <div>
            <label className="label text-xs" htmlFor="filterQuery">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="filterQuery"
                name="q"
                defaultValue={query}
                placeholder="Name, Student ID, or reference"
                className="input pl-9"
              />
            </div>
          </div>
          <div>
            <label className="label text-xs" htmlFor="filterStatus">
              Status
            </label>
            <select
              id="filterStatus"
              name="status"
              defaultValue={status}
              className="input"
            >
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="verified">Verified</option>
              <option value="no_show">No-show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="filterCampus">
              Campus
            </label>
            <select
              id="filterCampus"
              name="campus"
              defaultValue={campus}
              className="input"
            >
              <option value="">All campuses</option>
              <option value="MAIN">Main</option>
              <option value="SAMAL">SAMAL</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary flex-1">
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <Link
              href={`/admin/appointments?date=${date}`}
              className="btn-ghost"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      <div className="hidden print:block">
        <div className="flex items-center gap-3">
          <Image
            src="/sdsd-logo.png"
            alt="SDSD logo"
            width={224}
            height={256}
            sizes="48px"
            className="h-12 w-12 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold">
              SDSD Q appointment list — {formatLongDate(date)}
            </h1>
            <p className="text-sm text-slate-600">
              {stats.slotsBooked} booked · {stats.verified} verified ·{" "}
              {stats.noShow} no-show
            </p>
          </div>
        </div>
      </div>

      <AppointmentsBoard date={date} stats={stats} rows={rows} />

      <div className="no-print flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {total === 0 ? 0 : offset + 1}–
          {Math.min(offset + pageSize, total)} of {total} appointment
          {total === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/admin/appointments${buildQuery({
                ...baseParams,
                page: String(page - 1),
              })}`}
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
              href={`/admin/appointments${buildQuery({
                ...baseParams,
                page: String(page + 1),
              })}`}
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
