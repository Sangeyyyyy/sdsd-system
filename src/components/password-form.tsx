"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import {
  changeOwnPasswordAction,
  type PasswordChangeState,
} from "@/app/admin/actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<
    PasswordChangeState,
    FormData
  >(changeOwnPasswordAction, {});

  return (
    <div>
      {state.success && (
        <div className="mb-4 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Password updated. Use the new one next time you sign in.</span>
        </div>
      )}

      {state.error && (
        <div className="mb-4 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <form
        key={state.success ? "changed" : "editing"}
        action={formAction}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            className="input"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={12}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              At least 12 characters.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
