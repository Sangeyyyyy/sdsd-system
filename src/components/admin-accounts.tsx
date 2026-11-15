"use client";

import { useActionState, useState } from "react";
import {
  Check,
  ClipboardCopy,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  createAdminAction,
  resetAdminPasswordAction,
  type CreateAdminState,
  type ResetPasswordState,
} from "@/app/admin/actions";
import type { AdminRole } from "@/lib/auth";

function roleLabel(role: AdminRole): string {
  return role === "super_admin" ? "Super admin" : "Staff";
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

function TempPassword({ value }: { value: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <code className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}

export function CreateAdminForm() {
  const [state, formAction, pending] = useActionState<CreateAdminState, FormData>(
    createAdminAction,
    {},
  );

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-900">Add an account</h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        The system generates a temporary password. Copy it and hand it to the
        staff member — it is shown only once.
      </p>

      {state.created && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            Account created for {state.created.displayName} (@
            {state.created.username}) as {roleLabel(state.created.role)}.
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Temporary password — shown once
          </p>
          <TempPassword value={state.created.tempPassword} />
          <p className="mt-2 text-xs leading-relaxed text-emerald-800">
            Ask them to change it under <strong>My account</strong> after signing
            in. You will not be able to see it again.
          </p>
        </div>
      )}

      {state.error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <form
        key={state.created ? state.created.username : "new-account"}
        action={formAction}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]"
      >
        <div>
          <label className="label text-xs" htmlFor="newDisplayName">
            Display name
          </label>
          <input
            id="newDisplayName"
            name="displayName"
            className="input"
            placeholder="Maria Santos"
            maxLength={80}
            required
          />
        </div>
        <div>
          <label className="label text-xs" htmlFor="newUsername">
            Username
          </label>
          <input
            id="newUsername"
            name="username"
            className="input"
            placeholder="maria.santos"
            autoComplete="off"
            spellCheck={false}
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
            title="3–32 characters. Must start with a letter or number. Only letters, numbers, dots, underscores, and hyphens allowed."
            required
          />
        </div>
        <div>
          <label className="label text-xs" htmlFor="newRole">
            Role
          </label>
          <select id="newRole" name="role" className="input" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="btn-primary w-full lg:w-auto"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {pending ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ResetPasswordForm({
  id,
  username,
  disabled,
}: {
  id: number;
  username: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ResetPasswordState,
    FormData
  >(resetAdminPasswordAction, {});

  if (disabled) return null;

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="username" value={username} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <KeyRound className="h-3.5 w-3.5" />
        )}
        {pending ? "Resetting…" : "Reset password"}
      </button>

      {state.error && (
        <p className="mt-1.5 text-xs text-rose-600">{state.error}</p>
      )}

      {state.reset && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            New password for @{state.reset.username} — shown once
          </p>
          <TempPassword value={state.reset.tempPassword} />
        </div>
      )}
    </form>
  );
}
