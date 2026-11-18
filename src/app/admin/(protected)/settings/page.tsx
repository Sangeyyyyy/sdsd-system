import type { Metadata } from "next";
import {
  AlertCircle,
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Info,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  addBlockedDateAction,
  removeBlockedDateAction,
  resetBookingsAction,
  updateSettingsAction,
} from "@/app/admin/actions";
import { requireSession } from "@/lib/auth";
import { getDashboard } from "@/lib/queries";
import { getBlockedDates, getSettings } from "@/lib/settings";
import {
  formatShortDate,
  formatWeekday,
  todayISO,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function hourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const saved = first(params.saved) === "1";
  const resetDone = first(params.reset) === "1";
  const resetCount = Number.parseInt(first(params.n), 10);
  const errorMessage = first(params.error);
  const session = await requireSession();
  const canEdit = session.role === "super_admin";

  const [settings, blockedDates, dashboard] = await Promise.all([
    getSettings(),
    getBlockedDates(),
    getDashboard(),
  ]);

  const activeStudents = settings.samalEnabled
    ? dashboard.totals.students
    : dashboard.totals.main;
  const estimatedDays = Math.max(
    1,
    Math.ceil(activeStudents / Math.max(1, settings.dailyLimit)),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Capacity, office schedule, and campus controls.
        </p>
      </div>

      {saved && (
        <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Settings saved.</span>
        </div>
      )}

      {resetDone && (
        <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            All bookings were reset
            {Number.isFinite(resetCount)
              ? ` (${resetCount} appointment${resetCount === 1 ? "" : "s"} deleted)`
              : ""}
            . Students can book again.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!canEdit && (
        <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Settings are read-only for your account. Only a super admin can
            change booking controls or blocked dates.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <form action={updateSettingsAction} className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Booking controls
            </h2>
          </div>

          <div className="mt-5 space-y-5">
            <Toggle
              name="bookingOpen"
              defaultChecked={settings.bookingOpen}
              title="Accept new bookings"
              description="Turn this off to pause the public booking page temporarily. Existing appointments are not affected."
              disabled={!canEdit}
            />

            <Toggle
              name="samalEnabled"
              defaultChecked={settings.samalEnabled}
              title="Include SAMAL campus"
              description="Off by default. Enable only after the supervisor approves SAMAL students for in-person verification."
              warning
              disabled={!canEdit}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="dailyLimit">
                  Daily limit
                </label>
                <input
                  id="dailyLimit"
                  name="dailyLimit"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={settings.dailyLimit}
                  className="input"
                  disabled={!canEdit}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Slots per office day.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="sameDayCutoffHour">
                  Same-day cutoff
                </label>
                <select
                  id="sameDayCutoffHour"
                  name="sameDayCutoffHour"
                  defaultValue={settings.sameDayCutoffHour}
                  className="input"
                  disabled={!canEdit}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Manila time. After this, booking starts on the next office
                  day.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="maxRebooks">
                  Max rebookings
                </label>
                <input
                  id="maxRebooks"
                  name="maxRebooks"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={settings.maxRebooks}
                  className="input"
                  disabled={!canEdit}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Allowed after no-shows.
                </p>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="mt-6 flex items-center justify-end border-t border-slate-100 pt-4">
              <button type="submit" className="btn-primary">
                <Save className="h-4 w-4" />
                Save settings
              </button>
            </div>
          )}
        </form>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Capacity snapshot
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <SummaryRow label="Roster total" value={dashboard.totals.students} />
              <SummaryRow label="Main campus" value={dashboard.totals.main} />
              <SummaryRow label="SAMAL campus" value={dashboard.totals.samal} />
              <SummaryRow
                label="Bookable students"
                value={activeStudents}
              />
              <SummaryRow label="Daily limit" value={settings.dailyLimit} />
            </dl>

            <div className="mt-4 rounded-xl bg-indigo-50 px-3.5 py-3 text-xs leading-relaxed text-indigo-800">
              At {settings.dailyLimit} slots per day, the current bookable
              roster needs about{" "}
              <strong>{estimatedDays} office day{estimatedDays === 1 ? "" : "s"}</strong>{" "}
              (Monday–Thursday).
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Next office days
            </h2>
            <ul className="mt-3 space-y-2">
              {dashboard.upcoming.slice(0, 5).map((day) => {
                const left = Math.max(0, day.capacity - day.booked);
                return (
                  <li
                    key={day.date}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-700">
                      {formatShortDate(day.date)}{" "}
                      <span className="text-slate-500">
                        {formatWeekday(day.date)}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      {day.blocked
                        ? "Blocked"
                        : left === 0
                          ? "Full"
                          : `${left} left`}
                    </span>
                  </li>
                );
              })}
              {dashboard.upcoming.length === 0 && (
                <li className="text-xs text-slate-500">No upcoming days.</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                A basic in-memory rate limiter protects the public lookup and
                booking endpoints. It resets when the server restarts. A durable
                limiter is planned for a later stage.
              </p>
            </div>
          </section>
        </div>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-5 w-5 text-rose-500" />
          <h2 className="text-sm font-semibold text-slate-900">
            Blocked dates
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Blocked dates are skipped when assigning the earliest open day.
          Existing appointments on a blocked date are not cancelled
          automatically.
        </p>

        {canEdit && (
          <form
            action={addBlockedDateAction}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.6fr_auto]"
          >
            <div>
              <label className="label text-xs" htmlFor="blockedDate">
                Date
              </label>
              <input
                id="blockedDate"
                name="date"
                type="date"
                min={todayISO()}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="blockedReason">
                Reason (optional)
              </label>
              <input
                id="blockedReason"
                name="reason"
                placeholder="Holiday, office event, etc."
                className="input"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Block date
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Reason</th>
                <th className="w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedDates.map((item) => (
                <tr key={item.date}>
                  <td className="font-semibold text-slate-900">
                    {formatShortDate(item.date)}
                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                      {item.date}
                    </span>
                  </td>
                  <td>{formatWeekday(item.date)}</td>
                  <td className="text-sm text-slate-600">
                    {item.reason || "—"}
                  </td>
                  <td>
                    {canEdit ? (
                      <form action={removeBlockedDateAction}>
                        <input type="hidden" name="date" value={item.date} />
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                        >
                          Unblock
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {blockedDates.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                    No blocked dates.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          If a date already has bookings and you block it, contact those
          students manually. The system will not move them.
        </p>
      </section>

      {canEdit && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Danger zone
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Permanently delete all appointments and reset every day&apos;s
            queue counter. This also clears students&apos; no-show history,
            rebooking counts, and verified status. Students, admin accounts,
            settings, and blocked dates are kept.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Appointments currently stored:{" "}
            <strong className="text-slate-900">
              {dashboard.totals.appointments.toLocaleString()}
            </strong>
          </p>

          <form
            action={resetBookingsAction}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="label text-xs" htmlFor="resetConfirm">
                Type <strong>RESET</strong> to confirm
              </label>
              <input
                id="resetConfirm"
                name="confirm"
                placeholder="RESET"
                autoComplete="off"
                className="input"
                required
              />
            </div>
            <button type="submit" className="btn-danger">
              <Trash2 className="h-4 w-4" />
              Reset all bookings
            </button>
          </form>

          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This cannot be undone. Export the appointment list first if you
            need a record.
          </p>
        </section>
      )}

      <p className="text-center text-xs text-slate-500">
        Office schedule is fixed to Monday–Thursday. Dates are handled in
        Asia/Manila time.
      </p>
    </div>
  );
}

function Toggle({
  name,
  defaultChecked,
  title,
  description,
  warning = false,
  disabled = false,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  description: string;
  warning?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex gap-3 rounded-xl border p-3.5 ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      } ${
        warning
          ? "border-amber-200 bg-amber-50/60"
          : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
          {description}
        </span>
      </span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value.toLocaleString()}</dd>
    </div>
  );
}
