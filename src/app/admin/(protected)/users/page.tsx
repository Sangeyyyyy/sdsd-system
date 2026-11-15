import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { setAdminActiveAction, updateAdminAction } from "@/app/admin/actions";
import { CreateAdminForm, ResetPasswordForm } from "@/components/admin-accounts";
import { requireSuperAdmin } from "@/lib/auth";
import { listAdmins, MAX_ADMIN_ACCOUNTS, roleLabel } from "@/lib/admins";
import { formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accounts",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSuperAdmin();
  const params = await searchParams;
  const saved = first(params.saved) === "1";
  const errorMessage = first(params.error);

  const admins = await listAdmins();
  const activeCount = admins.filter((admin) => admin.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Staff accounts for the SDSD office. Only super admins can see this
            page.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {activeCount} of {MAX_ADMIN_ACCOUNTS} active accounts
        </p>
      </div>

      {saved && (
        <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Account changes saved.</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <CreateAdminForm />

      <section className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th className="w-72">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const isSelf = admin.id === session.id;
              return (
                <tr key={admin.id} className={admin.isActive ? "" : "bg-slate-50/60"}>
                  <td>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {admin.displayName}
                      </p>
                      {isSelf && (
                        <span className="badge bg-indigo-100 text-indigo-700">
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        admin.role === "super_admin"
                          ? "badge bg-indigo-100 text-indigo-700"
                          : "badge bg-slate-100 text-slate-600"
                      }
                    >
                      {admin.role === "super_admin" && (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      {roleLabel(admin.role)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        admin.isActive
                          ? "badge bg-emerald-100 text-emerald-700"
                          : "badge bg-rose-100 text-rose-700"
                      }
                    >
                      {admin.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">
                    {formatTimestamp(admin.lastLoginAt)}
                  </td>
                  <td>
                    {isSelf ? (
                      <Link
                        href="/admin/account"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Edit in My account
                      </Link>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <ResetPasswordForm
                          id={admin.id}
                          username={admin.username}
                        />

                        <form action={setAdminActiveAction} className="inline">
                          <input type="hidden" name="id" value={admin.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={admin.isActive ? "0" : "1"}
                          />
                          <button
                            type="submit"
                            className={
                              admin.isActive
                                ? "inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                : "inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            }
                          >
                            {admin.isActive ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                            {admin.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>

                        <details className="w-full">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">
                            Edit name or role
                          </summary>
                          <form
                            action={updateAdminAction}
                            className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <input type="hidden" name="id" value={admin.id} />
                            <div>
                              <label
                                className="label text-xs"
                                htmlFor={`name-${admin.id}`}
                              >
                                Display name
                              </label>
                              <input
                                id={`name-${admin.id}`}
                                name="displayName"
                                className="input"
                                defaultValue={admin.displayName}
                                maxLength={80}
                                required
                              />
                            </div>
                            <div>
                              <label
                                className="label text-xs"
                                htmlFor={`role-${admin.id}`}
                              >
                                Role
                              </label>
                              <select
                                id={`role-${admin.id}`}
                                name="role"
                                className="input"
                                defaultValue={admin.role}
                              >
                                <option value="staff">Staff</option>
                                <option value="super_admin">Super admin</option>
                              </select>
                            </div>
                            <button
                              type="submit"
                              className="btn-secondary w-full py-1.5 text-xs"
                            >
                              Save changes
                            </button>
                          </form>
                        </details>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>
          You cannot deactivate your own account or remove the last active super
          admin. Deactivating an account signs that person out immediately and
          blocks new sign-ins. Accounts are never deleted, so the audit log
          keeps its history.
        </p>
      </div>
    </div>
  );
}
