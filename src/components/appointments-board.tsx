"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ScanLine,
  Ticket,
  UserX,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { AppointmentStatus } from "@/lib/booking";
import type { AdminAppointment, DayStats } from "@/lib/queries";
import { formatQueue, formatTimestamp } from "@/lib/dates";

type Toast = {
  key: number;
  kind: "success" | "error" | "info";
  text: string;
};

type BoardProps = {
  date: string;
  stats: DayStats;
  rows: AdminAppointment[];
};

const ACTIVE_STATUSES = new Set<AppointmentStatus>(["booked", "verified"]);

function statsAfterTransition(
  stats: DayStats,
  from: AppointmentStatus,
  to: AppointmentStatus,
): DayStats {
  const wasActive = ACTIVE_STATUSES.has(from);
  const isActive = ACTIVE_STATUSES.has(to);
  const slotsBooked = stats.slotsBooked + (wasActive && !isActive ? -1 : 0) + (!wasActive && isActive ? 1 : 0);

  const count = (s: AppointmentStatus) =>
    (from === s ? -1 : 0) + (to === s ? 1 : 0);

  return {
    ...stats,
    slotsBooked,
    slotsRemaining: Math.max(0, stats.capacity - slotsBooked),
    booked: stats.booked + count("booked"),
    verified: stats.verified + count("verified"),
    noShow: stats.noShow + count("no_show"),
    cancelled: stats.cancelled + count("cancelled"),
  };
}

export function AppointmentsBoard({ date, stats, rows }: BoardProps) {
  const [lastProps, setLastProps] = useState({ stats, rows });
  const [state, setState] = useState({ stats, rows });
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [quickPending, setQuickPending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [quickQueue, setQuickQueue] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server data (filters, pagination) is the source of truth: adopt new props
  // during render so filter/pagination navigation resets the optimistic state.
  if (stats !== lastProps.stats || rows !== lastProps.rows) {
    setLastProps({ stats, rows });
    setState({ stats, rows });
    // Keep a selection across auto-refreshes, but drop ids that are no longer
    // on this page after a filter or pagination change.
    const visibleIds = new Set(rows.map((row) => row.id));
    setSelectedIds((ids) => {
      const kept = [...ids].filter((id) => visibleIds.has(id));
      return kept.length === ids.size ? ids : new Set(kept);
    });
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(kind: Toast["kind"], text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ key: Date.now(), kind, text });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  async function changeStatus(
    row: AdminAppointment,
    next: AppointmentStatus,
  ): Promise<boolean> {
    const previous = row.status;
    if (previous === next) return true;

    setPendingIds((ids) => new Set(ids).add(row.id));
    setState((s) => ({
      stats: statsAfterTransition(s.stats, previous, next),
      rows: s.rows.map((r) => (r.id === row.id ? { ...r, status: next } : r)),
    }));

    try {
      const response = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status: next }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        // Revert to the state before the optimistic update.
        setState((s) => ({
          stats: statsAfterTransition(s.stats, next, previous),
          rows: s.rows.map((r) =>
            r.id === row.id ? { ...r, status: previous } : r,
          ),
        }));
        showToast(
          "error",
          data.message ?? "Update failed. The change was rolled back.",
        );
        return false;
      }
      return true;
    } catch {
      setState((s) => ({
        stats: statsAfterTransition(s.stats, next, previous),
        rows: s.rows.map((r) =>
          r.id === row.id ? { ...r, status: previous } : r,
        ),
      }));
      showToast("error", "Network error. The change was rolled back.");
      return false;
    } finally {
      setPendingIds((ids) => {
        const rest = new Set(ids);
        rest.delete(row.id);
        return rest;
      });
    }
  }

  async function handleVerify(row: AdminAppointment) {
    const ok = await changeStatus(row, "verified");
    if (ok) {
      showToast(
        "success",
        `Queue ${formatQueue(row.queueNumber)} — ${row.fullName} verified.`,
      );
    }
  }

  async function handleNoShow(row: AdminAppointment) {
    const ok = await changeStatus(row, "no_show");
    if (ok) {
      showToast(
        "info",
        `Queue ${formatQueue(row.queueNumber)} — ${row.fullName} marked as no-show.`,
      );
    }
  }

  async function handleUndo(row: AdminAppointment) {
    const ok = await changeStatus(row, "booked");
    if (ok) {
      showToast(
        "success",
        `Queue ${formatQueue(row.queueNumber)} — ${row.fullName} restored to booked.`,
      );
    }
  }

  async function handleQuickVerify(event: React.FormEvent) {    event.preventDefault();
    const queue = Number.parseInt(quickQueue.trim(), 10);
    if (!Number.isInteger(queue) || queue < 1 || queue > 9999) {
      showToast("error", "Enter a queue number between 1 and 9999.");
      return;
    }

    setQuickPending(true);
    try {
      const lookupResponse = await fetch(
        `/api/admin/queue?date=${encodeURIComponent(date)}&queue=${queue}`,
      );
      const lookup = (await lookupResponse.json()) as {
        ok: boolean;
        message?: string;
        appointment?: AdminAppointment;
      };

      if (!lookupResponse.ok || !lookup.ok || !lookup.appointment) {
        showToast(
          "error",
          lookup.message ??
            `No appointment with queue ${formatQueue(queue)} on this date.`,
        );
        return;
      }

      const appointment = lookup.appointment;
      if (appointment.status === "verified") {
        showToast(
          "info",
          `Queue ${formatQueue(queue)} — ${appointment.fullName} was already verified.`,
        );
        return;
      }
      if (appointment.status === "no_show" || appointment.status === "cancelled") {
        showToast(
          "info",
          `Queue ${formatQueue(queue)} — ${appointment.fullName} is ${appointment.status === "no_show" ? "marked as no-show" : "cancelled"}. Use Undo in the list to restore.`,
        );
        return;
      }

      const ok = await changeStatus(appointment, "verified");
      if (ok) {
        showToast(
          "success",
          `Queue ${formatQueue(queue)} — ${appointment.fullName} verified.`,
        );
      }
    } catch {
      showToast("error", "Network error. Please try again.");
    } finally {
      setQuickPending(false);
      setQuickQueue("");
      quickInputRef.current?.focus();
    }
  }

  function revertBulk(
    previous: Map<number, AppointmentStatus>,
    next: AppointmentStatus,
  ) {
    setState((s) => {
      let nextStats = s.stats;
      for (const status of previous.values()) {
        nextStats = statsAfterTransition(nextStats, next, status);
      }
      return {
        stats: nextStats,
        rows: s.rows.map((row) => {
          const before = previous.get(row.id);
          return before ? { ...row, status: before } : row;
        }),
      };
    });
  }

  function toggleRow(id: number) {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(
      checked ? new Set(state.rows.map((row) => row.id)) : new Set(),
    );
  }

  async function handleBulk(next: AppointmentStatus) {
    const targets = state.rows.filter(
      (row) => selectedIds.has(row.id) && row.status !== next,
    );

    if (targets.length === 0) {
      showToast("info", "The selected appointments already have that status.");
      return;
    }

    const previous = new Map(targets.map((row) => [row.id, row.status]));
    const targetIds = new Set(previous.keys());

    setBulkPending(true);
    setState((s) => {
      let nextStats = s.stats;
      for (const row of targets) {
        nextStats = statsAfterTransition(nextStats, row.status, next);
      }
      return {
        stats: nextStats,
        rows: s.rows.map((row) =>
          targetIds.has(row.id) ? { ...row, status: next } : row,
        ),
      };
    });

    try {
      const response = await fetch("/api/admin/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: targets.map((row) => row.id),
          status: next,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        updated?: number;
        failed?: number;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        revertBulk(previous, next);
        showToast(
          "error",
          data.message ?? "Bulk update failed. The changes were rolled back.",
        );
        return;
      }

      const updated = data.updated ?? targets.length;
      setSelectedIds(new Set());
      if (data.failed && data.failed > 0) {
        showToast(
          "info",
          `${updated} updated, ${data.failed} could not be changed.`,
        );
      } else {
        showToast(
          "success",
          `${updated} appointment${updated === 1 ? "" : "s"} updated.`,
        );
      }
    } catch {
      revertBulk(previous, next);
      showToast("error", "Network error. The changes were rolled back.");
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Quick verify by queue number */}
      <form onSubmit={handleQuickVerify} className="no-print card p-4">
        <label className="label text-xs" htmlFor="quickQueue">
          Quick verify by queue number
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="quickQueue"
              ref={quickInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={quickQueue}
              onChange={(e) => setQuickQueue(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={`Queue number for ${formatShortDateLite(date)}`}
              className="input pl-9 font-mono"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={quickPending}
            className="btn-primary shrink-0 border border-transparent sm:w-auto"
          >
            {quickPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Verify
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Type or paste the number on the student&apos;s pass — no searching
          needed. Works even if the student is on another page or filter.
        </p>
      </form>

      <MiniStats stats={state.stats} />

      {selectedIds.size > 0 && (
        <div className="no-print flex flex-col gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-800">
            {selectedIds.size} selected
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionButton
              label="Verify"
              tone="success"
              disabled={bulkPending}
              onClick={() => handleBulk("verified")}
            />
            <ActionButton
              label="No-show"
              tone="danger"
              disabled={bulkPending}
              onClick={() => handleBulk("no_show")}
            />
            <ActionButton
              label="Cancel"
              tone="danger"
              disabled={bulkPending}
              onClick={() => handleBulk("cancelled")}
            />
            <ActionButton
              label="Restore"
              tone="neutral"
              disabled={bulkPending}
              onClick={() => handleBulk("booked")}
            />
            {bulkPending && (
              <span className="flex items-center px-1 text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkPending}
              className="ml-1 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="no-print w-10">
                <input
                  type="checkbox"
                  aria-label="Select all appointments on this page"
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600"
                  checked={
                    state.rows.length > 0 &&
                    selectedIds.size === state.rows.length
                  }
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        selectedIds.size > 0 &&
                        selectedIds.size < state.rows.length;
                    }
                  }}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
              <th className="w-16">Queue</th>
              <th>Student</th>
              <th>Program</th>
              <th>Campus</th>
              <th>Status</th>
              <th>Booked at</th>
              <th className="no-print w-52">Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => {
              const pending = pendingIds.has(row.id);
              return (
                <tr key={row.id}>
                  <td className="no-print">
                    <input
                      type="checkbox"
                      aria-label={`Select queue ${formatQueue(row.queueNumber)}`}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  <td className="font-mono text-sm font-semibold text-slate-900">
                    {formatQueue(row.queueNumber)}
                  </td>
                  <td>
                    <p className="font-semibold text-slate-900">
                      {row.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.studentNo} ·{" "}
                      <span className="font-mono">{row.referenceCode}</span>
                    </p>
                  </td>
                  <td className="text-sm">{row.program}</td>
                  <td>
                    <span
                      className={
                        row.campus === "SAMAL"
                          ? "badge bg-amber-100 text-amber-800"
                          : "badge bg-slate-100 text-slate-600"
                      }
                    >
                      {row.campus === "SAMAL" ? "SAMAL" : "Main"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-slate-500">
                    {formatTimestamp(row.bookedAt)}
                  </td>
                  <td className="no-print">
                    <div className="flex flex-wrap gap-1.5">
                      {row.status === "booked" && (
                        <>
                          <ActionButton
                            label="Verify"
                            tone="success"
                            disabled={pending}
                            onClick={() => handleVerify(row)}
                          />
                          <ActionButton
                            label="No-show"
                            tone="danger"
                            disabled={pending}
                            onClick={() => handleNoShow(row)}
                          />
                        </>
                      )}
                      {row.status !== "booked" && (
                        <ActionButton
                          label="Undo"
                          tone="neutral"
                          disabled={pending}
                          onClick={() => handleUndo(row)}
                        />
                      )}
                      {pending && (
                        <span className="flex items-center px-1 text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {state.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    No appointments found.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try another date, clear the filters, or search by name.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

function formatShortDateLite(iso: string): string {
  const [, month, day] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[Number(month) - 1]} ${Number(day)}`;
}

function MiniStats({ stats }: { stats: DayStats }) {
  const items = [
    {
      label: "Booked",
      value: `${stats.booked}`,
      hint: `${stats.slotsRemaining} slots left`,
      icon: Ticket,
    },
    {
      label: "Verified",
      value: `${stats.verified}`,
      hint: "Processed today",
      icon: CheckCircle2,
    },
    {
      label: "No-shows",
      value: `${stats.noShow}`,
      hint: "Can rebook",
      icon: UserX,
    },
    {
      label: "Cancelled",
      value: `${stats.cancelled}`,
      hint: "Freed capacity",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <item.icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight text-slate-900">
              {item.value}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className="text-[11px] text-slate-500">{item.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: "success" | "danger" | "neutral";
  disabled?: boolean;
  onClick: () => void;
}) {
  const classes =
    tone === "success"
      ? "rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      : tone === "danger"
        ? "rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        : "rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50";

  return (
    <button type="button" className={classes} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function Toast({ toast }: { toast: Toast | null }) {
  if (!toast) return null;

  const styles =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : toast.kind === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div
      key={toast.key}
      role="status"
      className={`no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${styles}`}
    >
      {toast.text}
    </div>
  );
}
