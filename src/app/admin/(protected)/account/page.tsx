import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { updateOwnProfileAction } from "@/app/admin/actions";
import { ChangePasswordForm } from "@/components/password-form";
import { requireSession } from "@/lib/auth";
import { getAdminById, roleLabel } from "@/lib/admins";
import { formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My account",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const savedName = first(params.saved) === "name";
  const errorMessage = first(params.error);

  const admin = await getAdminById(session.id);
  if (!admin) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Your account could not be loaded. Please sign out and sign in again.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your sign-in details and password.
        </p>
      </div>

      {admin.mustChangePassword && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your password was reset by a super admin. Change it below so only
            you know it.
          </span>
        </div>
      )}

      {savedName && (
        <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Display name updated.</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
            </div>

            <form action={updateOwnProfileAction} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="displayName">
                  Display name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  className="input"
                  defaultValue={admin.displayName}
                  maxLength={80}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Shown in the audit log and on appointments you verify.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label">Username</p>
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                    @{admin.username}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Usernames cannot be changed.
                  </p>
                </div>
                <div>
                  <p className="label">Role</p>
                  <p className="mt-1">
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
                  </p>
                </div>
              </div>
              <button type="submit" className="btn-primary">
                Save profile
              </button>
            </form>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Change password
              </h2>
            </div>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              Use at least 12 characters. Changing your password signs out any
              other browser using your account.
            </p>
            <ChangePasswordForm />
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Account details
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Last sign-in</dt>
                <dd className="text-right font-medium text-slate-800">
                  {formatTimestamp(admin.lastLoginAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Password changed</dt>
                <dd className="text-right font-medium text-slate-800">
                  {formatTimestamp(admin.passwordChangedAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={
                      admin.isActive
                        ? "badge bg-emerald-100 text-emerald-700"
                        : "badge bg-rose-100 text-rose-700"
                    }
                  >
                    {admin.isActive ? "Active" : "Deactivated"}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                Super admins manage accounts at{" "}
                <Link
                  href="/admin/users"
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Accounts
                </Link>
                . If you are a staff member, you will only see that link if your
                role allows it.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
