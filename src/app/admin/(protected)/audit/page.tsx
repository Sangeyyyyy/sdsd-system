import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Filter, ScrollText, X } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import {
  auditActionLabel,
  AUDIT_PAGE_SIZE,
  countAuditEntries,
  listAuditActions,
  listAuditActors,
  listAuditEntries,
  type AuditFilters,
} from "@/lib/audit";
import { formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity log",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function toPositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function actionTone(action: string): string {
  if (action === "status:verified") return "bg-emerald-100 text-emerald-700";
  if (action === "status:no_show") return "bg-rose-100 text-rose-700";
  if (action === "status:booked") return "bg-indigo-100 text-indigo-700";
  if (action === "status:cancelled") return "bg-slate-100 text-slate-600";
  if (action.startsWith("admin.")) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const page = toPositiveInt(first(params.page), 1);
  const adminId = toPositiveInt(first(params.admin), 0) || null;
  const action = first(params.action) || null;
  const from = first(params.from) || null;
  const to = first(params.to) || null;

  const filters: AuditFilters = { adminId, action, from, to };

  const [entries, total, actors, actions] = await Promise.all([
    listAuditEntries(filters, page),
    countAuditEntries(filters),
    listAuditActors(),
    listAuditActions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const hasFilters = Boolean(adminId || action || from || to);

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (adminId) query.set("admin", String(adminId));
    if (action) query.set("action", action);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/admin/audit?${suffix}` : "/admin/audit";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Activity log
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Every appointment change and account change, newest first.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {total.toLocaleString()} {total === 1 ? "entry" : "entries"}
          {hasFilters ? " matching filters" : ""}
        </p>
      </div>

      <form
        action="/admin/audit"
        method="get"
        className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]"
      >
        <div>
          <label className="label text-xs" htmlFor="filterAdmin">
            Staff member
          </label>
          <select
            id="filterAdmin"
            name="admin"
            className="input"
            defaultValue={adminId ? String(adminId) : ""}
          >
            <option value="">Everyone</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.displayName} (@{actor.username})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label text-xs" htmlFor="filterAction">
            Action
          </label>
          <select
            id="filterAction"
            name="action"
            className="input"
            defaultValue={action ?? ""}
          >
            <option value="">All actions</option>
            {actions.map((item) => (
              <option key={item.action} value={item.action}>
                {auditActionLabel(item.action)} ({item.count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label text-xs" htmlFor="filterFrom">
            From
          </label>
          <input
            id="filterFrom"
            name="from"
            type="date"
            className="input"
            defaultValue={from ?? ""}
          />
        </div>

        <div>
          <label className="label text-xs" htmlFor="filterTo">
            To
          </label>
          <input
            id="filterTo"
            name="to"
            type="date"
            className="input"
            defaultValue={to ?? ""}
          />
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary w-full sm:w-auto">
            <Filter className="h-4 w-4" />
            Apply
          </button>
          {hasFilters && (
            <Link
              href="/admin/audit"
              className="btn-secondary"
              title="Clear filters"
            >
              <X className="h-4 w-4" />
              Clear
            </Link>
          )}
        </div>
      </form>

      <section className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Staff</th>
              <th>Action</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap text-xs text-slate-500">
                  {formatTimestamp(entry.createdAt)}
                </td>
                <td>
                  {entry.adminName ? (
                    <>
                      <p className="text-sm font-medium text-slate-800">
                        {entry.adminName}
                      </p>
                      <p className="text-xs text-slate-500">
                        @{entry.adminUsername}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">System</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${actionTone(entry.action)}`}>
                    {auditActionLabel(entry.action)}
                  </span>
                </td>
                <td className="text-xs text-slate-500">
                  {entry.appointmentId ? (
                    <span className="font-semibold text-slate-600">
                      Appointment #{entry.appointmentId}
                    </span>
                  ) : (
                    "Account"
                  )}
                </td>
                <td className="max-w-md text-sm text-slate-600">
                  {entry.details || "—"}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                  <ScrollText className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                  No activity matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            {safePage > 1 ? (
              <Link href={pageHref(safePage - 1)} className="btn-secondary">
                <ArrowLeft className="h-4 w-4" />
                Newer
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-50">
                <ArrowLeft className="h-4 w-4" />
                Newer
              </span>
            )}
            {safePage < totalPages ? (
              <Link href={pageHref(safePage + 1)} className="btn-secondary">
                Older
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-50">
                Older
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
