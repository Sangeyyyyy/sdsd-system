import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Settings,
  ShieldAlert,
  Ticket,
  UserX,
  Users,
} from "lucide-react";
import { getDashboard } from "@/lib/queries";
import { requireSession } from "@/lib/auth";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  formatLongDate,
  formatShortDate,
  formatWeekday,
  isOfficeDay,
  nextOfficeDay,
  todayISO,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const denied = params.denied === "1";

  const data = await getDashboard();
  const stats = data.todayStats;
  const today = todayISO();
  const officeOpenToday = isOfficeDay(today);
  const nextOpenDate = nextOfficeDay(today, false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            {formatLongDate(data.today)} · SDSD office
            <AutoRefresh />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/appointments?date=${today}`}
            className="btn-primary"
          >
            <Ticket className="h-4 w-4" />
            Today&apos;s queue
          </Link>
          <Link
            href={`/api/admin/export?date=${today}`}
            className="btn-secondary"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Link>
        </div>
      </div>

      {denied && (
        <div className="flex gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            That page is limited to super admins. Ask admin1 if you need access.
          </p>
        </div>
      )}

      {session.mustChangePassword && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Your password was reset by a super admin. Set a new one so only
              you know it.
            </p>
          </div>
          <Link
            href="/admin/account"
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Change password
          </Link>
        </div>
      )}

      {!officeOpenToday && (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2.5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>
              The office is <strong>closed today</strong>. The next office day
              is{" "}
              <strong className="font-semibold">
                {formatLongDate(nextOpenDate)}
              </strong>
              .
            </p>
          </div>
          <Link
            href={`/admin/appointments?date=${nextOpenDate}`}
            className="shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Open that day
          </Link>
        </div>
      )}

      {!data.samalEnabled && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              The <strong>SAMAL campus</strong> cohort ({data.totals.samal}{" "}
              students) is currently hidden and cannot book. Turn it on in
              Settings once approved.
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="shrink-0 text-sm font-semibold underline underline-offset-2"
          >
            Open settings
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Ticket}
          label="Today's queue"
          value={
            officeOpenToday
              ? `${stats.slotsBooked} / ${stats.capacity}`
              : "Closed"
          }
          hint={
            officeOpenToday
              ? `${stats.slotsRemaining} slot${stats.slotsRemaining === 1 ? "" : "s"} left`
              : `Opens ${formatShortDate(nextOpenDate)}`
          }
          tone="indigo"
        />
        <StatCard
          icon={CheckCircle2}
          label="Verified today"
          value={String(stats.verified)}
          hint="Students processed"
          tone="emerald"
        />
        <StatCard
          icon={UserX}
          label="No-shows today"
          value={String(stats.noShow)}
          hint="May rebook"
          tone="rose"
        />
        <StatCard
          icon={Users}
          label="First-year roster"
          value={String(data.totals.students)}
          hint={`${data.totals.main} main · ${data.totals.samal} SAMAL`}
          tone="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="table-wrap">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Upcoming office days
              </h2>
              <p className="text-xs text-slate-500">
                Capacity fills from the earliest day forward.
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage capacity
            </Link>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Booked</th>
                <th>Left</th>
                <th>Verified</th>
                <th>No-show</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming.map((day) => {
                const left = Math.max(0, day.capacity - day.booked);
                return (
                  <tr key={day.date}>
                    <td>
                      <Link
                        href={`/admin/appointments?date=${day.date}`}
                        className="font-semibold text-slate-900 hover:text-indigo-600"
                      >
                        {formatShortDate(day.date)}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">
                        {formatWeekday(day.date)}
                      </span>
                    </td>
                    <td className="font-medium">
                      {day.booked} / {day.capacity}
                    </td>
                    <td>{left}</td>
                    <td>{day.verified}</td>
                    <td>{day.noShow}</td>
                    <td>
                      {day.blocked ? (
                        <span className="badge bg-rose-100 text-rose-700">
                          Blocked
                        </span>
                      ) : left === 0 ? (
                        <span className="badge bg-slate-100 text-slate-600">
                          Full
                        </span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-700">
                          Open
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.upcoming.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    No upcoming office days. Check Settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Quick actions
            </h2>
            <div className="mt-3 space-y-1.5">
              <QuickLink
                href={`/admin/appointments?date=${today}`}
                icon={CalendarDays}
                label="Today's appointment list"
              />
              <QuickLink
                href="/admin/students"
                icon={Users}
                label="Search the student roster"
              />
              <QuickLink
                href="/admin/settings"
                icon={Settings}
                label="Capacity and blocked dates"
              />
              <QuickLink
                href={`/api/admin/export?date=${today}`}
                icon={Download}
                label="Download today's CSV"
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Roster and activity
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Total students" value={data.totals.students} />
              <Row label="Main campus" value={data.totals.main} />
              <Row label="SAMAL campus" value={data.totals.samal} />
              <Row label="All appointments" value={data.totals.appointments} />
              <Row label="Verified (all time)" value={data.totals.verified} />
              <Row label="No-shows (all time)" value={data.totals.noShow} />
              <Row label="Daily limit" value={data.dailyLimit} />
            </dl>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Clock className="h-3.5 w-3.5" />
                SAMAL booking
              </span>
              <span
                className={
                  data.samalEnabled
                    ? "badge bg-emerald-100 text-emerald-700"
                    : "badge bg-slate-200 text-slate-600"
                }
              >
                {data.samalEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "indigo" | "emerald" | "rose" | "slate";
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
    </Link>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value.toLocaleString()}</dd>
    </div>
  );
}
