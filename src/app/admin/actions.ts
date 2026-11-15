"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ensureDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import {
  createSession,
  destroySession,
  requireSession,
  requireSuperAdmin,
  type AdminRole,
} from "@/lib/auth";
import {
  changeOwnPassword,
  createAdmin,
  recordLogin,
  resetAdminPassword,
  setAdminActive,
  updateAdminProfile,
  updateOwnProfile,
} from "@/lib/admins";
import { setAppointmentStatus } from "@/lib/queries";
import {
  addBlockedDate,
  removeBlockedDate,
  updateSettings,
} from "@/lib/settings";
import type { AppointmentStatus } from "@/lib/booking";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Enter your username and password." };
  }

  // Rate-limit sign-in attempts: 5 per minute per IP+username combination.
  // This slows targeted password guessing while still allowing a user who
  // misremembers their password to retry a few times before waiting.
  const h = await headers();
  const ip = clientIp(h);
  const loginLimit = rateLimit(`login:${ip}:${username}`, 5, 60_000);
  if (!loginLimit.ok) {
    return { error: "Too many sign-in attempts. Please wait a minute and try again." };
  }

  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT id, username, password_hash, display_name, is_active, session_version
          FROM admins WHERE username = ? LIMIT 1`,
    args: [username],
  });
  const admin = result.rows[0];

  if (!admin) {
    return { error: "Invalid username or password." };
  }

  const valid = await verifyPassword(password, String(admin.password_hash));
  if (!valid) {
    return { error: "Invalid username or password." };
  }

  if (Number(admin.is_active) !== 1) {
    return { error: "Invalid username or password." };
  }

  await recordLogin(Number(admin.id));
  await createSession({
    id: Number(admin.id),
    sessionVersion: Number(admin.session_version),
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

function safeRedirect(value: string): string {
  return value.startsWith("/admin") ? value : "/admin/appointments";
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "") as AppointmentStatus;
  const redirectTo = safeRedirect(
    String(formData.get("redirectTo") ?? "/admin/appointments"),
  );

  if (!Number.isFinite(id) || id <= 0) {
    redirect(redirectTo);
  }

  const result = await setAppointmentStatus(id, status, session);

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/students");

  if (!result.ok) {
    redirect(
      `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(
        result.message ?? "Update failed.",
      )}`,
    );
  }

  redirect(redirectTo);
}

export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requireSession();

  const dailyLimit = Number(formData.get("dailyLimit"));
  const sameDayCutoffHour = Number(formData.get("sameDayCutoffHour"));
  const maxRebooks = Number(formData.get("maxRebooks"));
  const bookingOpen = formData.get("bookingOpen") === "on";
  const samalEnabled = formData.get("samalEnabled") === "on";

  await updateSettings({
    dailyLimit,
    sameDayCutoffHour,
    maxRebooks,
    bookingOpen,
    samalEnabled,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/book");
  revalidatePath("/");

  redirect("/admin/settings?saved=1");
}

export async function addBlockedDateAction(formData: FormData): Promise<void> {
  await requireSession();

  const date = String(formData.get("date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect("/admin/settings?error=Enter+a+valid+date");
  }

  await addBlockedDate(date, reason);
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/appointments");
  revalidatePath("/book");

  redirect("/admin/settings?saved=1");
}

export async function removeBlockedDateAction(
  formData: FormData,
): Promise<void> {
  await requireSession();

  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect("/admin/settings?error=Enter+a+valid+date");
  }

  await removeBlockedDate(date);
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/appointments");
  revalidatePath("/book");

  redirect("/admin/settings?saved=1");
}

export type CreateAdminState = {
  error?: string;
  created?: {
    username: string;
    displayName: string;
    role: AdminRole;
    tempPassword: string;
  };
};

export async function createAdminAction(
  _previous: CreateAdminState,
  formData: FormData,
): Promise<CreateAdminState> {
  const session = await requireSuperAdmin();
  const username = String(formData.get("username") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const role = String(formData.get("role") ?? "staff") as AdminRole;

  const result = await createAdmin({ username, displayName, role }, session);
  if (!result.ok) return { error: result.message };

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");

  return {
    created: {
      username: result.admin.username,
      displayName: result.admin.displayName,
      role: result.admin.role,
      tempPassword: result.tempPassword,
    },
  };
}

export type ResetPasswordState = {
  error?: string;
  reset?: { username: string; tempPassword: string };
};

export async function resetAdminPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const session = await requireSuperAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "Invalid account." };
  }

  const result = await resetAdminPassword({ id }, session);
  if (!result.ok) return { error: result.message };

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");

  return {
    reset: {
      username: String(formData.get("username") ?? ""),
      tempPassword: result.tempPassword,
    },
  };
}

export async function updateAdminAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdmin();
  const id = Number(formData.get("id"));
  const displayName = String(formData.get("displayName") ?? "");
  const role = String(formData.get("role") ?? "staff") as AdminRole;

  if (!Number.isFinite(id) || id <= 0) {
    redirect("/admin/users?error=Invalid+account");
  }

  const result = await updateAdminProfile({ id, displayName, role }, session);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");

  if (!result.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(result.message)}`);
  }
  redirect("/admin/users?saved=1");
}

export async function setAdminActiveAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdmin();
  const id = Number(formData.get("id"));
  const active = String(formData.get("active")) === "1";

  if (!Number.isFinite(id) || id <= 0) {
    redirect("/admin/users?error=Invalid+account");
  }

  const result = await setAdminActive({ id, active }, session);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");

  if (!result.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(result.message)}`);
  }
  redirect("/admin/users?saved=1");
}

export async function updateOwnProfileAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const displayName = String(formData.get("displayName") ?? "");

  const result = await updateOwnProfile({ id: session.id, displayName });
  revalidatePath("/admin");
  revalidatePath("/admin/account");

  if (!result.ok) {
    redirect(`/admin/account?error=${encodeURIComponent(result.message)}`);
  }
  redirect("/admin/account?saved=name");
}

export type PasswordChangeState = { error?: string; success?: boolean };

export async function changeOwnPasswordAction(
  _previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const session = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { error: "The new passwords do not match." };
  }

  const result = await changeOwnPassword({
    id: session.id,
    currentPassword,
    newPassword,
  });
  if (!result.ok) return { error: result.message };

  // The password change bumps the session version; re-issue this browser's
  // cookie so the current admin is not signed out.
  await createSession({ id: session.id, sessionVersion: result.sessionVersion });
  revalidatePath("/admin");
  revalidatePath("/admin/account");

  return { success: true };
}
