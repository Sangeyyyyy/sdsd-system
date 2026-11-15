import { randomInt } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { ensureDb } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { AdminRole } from "./auth";

/** Keep the office's credential list small enough to account for. */
export const MAX_ADMIN_ACCOUNTS = 10;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type AdminAccount = {
  id: number;
  username: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
};

export type AdminActor = { id: number; displayName: string };

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

type Executor = Client | Transaction;

function parseRole(value: unknown): AdminRole {
  return value === "super_admin" ? "super_admin" : "staff";
}

export function roleLabel(role: AdminRole): string {
  return role === "super_admin" ? "Super admin" : "Staff";
}

function mapAdmin(row: Record<string, unknown>): AdminAccount {
  return {
    id: Number(row.id),
    username: String(row.username),
    displayName: String(row.display_name || row.username),
    role: parseRole(row.role),
    isActive: Number(row.is_active) === 1,
    mustChangePassword: Number(row.must_change_password) === 1,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    passwordChangedAt: row.password_changed_at
      ? String(row.password_changed_at)
      : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 32) {
    return "Username must be 3 to 32 characters.";
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) {
    return "Use lowercase letters, numbers, dots, underscores, or hyphens.";
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  if (displayName.length < 1 || displayName.length > 80) {
    return "Display name must be 1 to 80 characters.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Human-readable temporary password: four groups of four characters. */
export function generateTempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const groups: string[] = [];
  for (let group = 0; group < 4; group += 1) {
    let chunk = "";
    for (let index = 0; index < 4; index += 1) {
      chunk += alphabet[randomInt(0, alphabet.length)];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

async function writeAudit(
  executor: Executor,
  actor: AdminActor,
  action: string,
  details: string,
): Promise<void> {
  await executor.execute({
    sql: "INSERT INTO audit_log (admin_id, action, appointment_id, details) VALUES (?, ?, NULL, ?)",
    args: [actor.id, action, details],
  });
}

async function countOtherActiveSuperAdmins(
  executor: Executor,
  excludeId: number,
): Promise<number> {
  const result = await executor.execute({
    sql: `SELECT COUNT(*) AS n FROM admins
          WHERE role = 'super_admin' AND is_active = 1 AND id <> ?`,
    args: [excludeId],
  });
  return Number(result.rows[0]?.n ?? 0);
}

export async function listAdmins(): Promise<AdminAccount[]> {
  const db = await ensureDb();
  const result = await db.execute(
    `SELECT id, username, display_name, role, is_active, must_change_password,
            last_login_at, password_changed_at, created_at
     FROM admins
     ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, created_at ASC`,
  );
  return result.rows.map((row) => mapAdmin(row as Record<string, unknown>));
}

export async function getAdminById(id: number): Promise<AdminAccount | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT id, username, display_name, role, is_active, must_change_password,
                 last_login_at, password_changed_at, created_at
          FROM admins WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];
  return row ? mapAdmin(row as Record<string, unknown>) : null;
}

export async function recordLogin(id: number): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "UPDATE admins SET last_login_at = datetime('now') WHERE id = ?",
    args: [id],
  });
}

export async function createAdmin(
  input: { username: string; displayName: string; role: AdminRole },
  actor: AdminActor,
): Promise<
  { ok: true; admin: AdminAccount; tempPassword: string } | { ok: false; message: string }
> {
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim();
  const role = parseRole(input.role);

  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, message: usernameError };

  const nameError = validateDisplayName(displayName);
  if (nameError) return { ok: false, message: nameError };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const db = await ensureDb();
  const tx = await db.transaction("write");

  try {
    const active = await tx.execute(
      "SELECT COUNT(*) AS n FROM admins WHERE is_active = 1",
    );
    if (Number(active.rows[0]?.n ?? 0) >= MAX_ADMIN_ACCOUNTS) {
      await tx.rollback();
      return {
        ok: false,
        message: `The office can have at most ${MAX_ADMIN_ACCOUNTS} active accounts. Deactivate one first.`,
      };
    }

    const duplicate = await tx.execute({
      sql: "SELECT id FROM admins WHERE lower(username) = ? LIMIT 1",
      args: [username],
    });
    if (duplicate.rows.length > 0) {
      await tx.rollback();
      return { ok: false, message: "That username is already taken." };
    }

    const inserted = await tx.execute({
      sql: `INSERT INTO admins
              (username, password_hash, display_name, role, is_active, must_change_password)
            VALUES (?, ?, ?, ?, 1, 1)
            RETURNING id`,
      args: [username, passwordHash, displayName, role],
    });
    const id = Number(inserted.rows[0]?.id);

    await writeAudit(
      tx,
      actor,
      "admin.created",
      `Created @${username} (${displayName}) as ${roleLabel(role)}`,
    );
    await tx.commit();

    const admin = await getAdminById(id);
    if (!admin) {
      return { ok: false, message: "Account was created but could not be loaded." };
    }
    return { ok: true, admin, tempPassword };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Transaction may already be closed.
    }
    if (String(error).includes("UNIQUE")) {
      return { ok: false, message: "That username is already taken." };
    }
    throw error;
  }
}

export async function updateAdminProfile(
  input: { id: number; displayName: string; role: AdminRole },
  actor: AdminActor,
): Promise<AdminActionResult> {
  const displayName = input.displayName.trim();
  const role = parseRole(input.role);

  const nameError = validateDisplayName(displayName);
  if (nameError) return { ok: false, message: nameError };

  const db = await ensureDb();
  const tx = await db.transaction("write");

  try {
    const current = await tx.execute({
      sql: "SELECT id, username, display_name, role, is_active FROM admins WHERE id = ?",
      args: [input.id],
    });
    const row = current.rows[0];
    if (!row) {
      await tx.rollback();
      return { ok: false, message: "Account not found." };
    }

    const currentRole = parseRole(row.role);
    const isActive = Number(row.is_active) === 1;

    if (role !== currentRole) {
      if (input.id === actor.id) {
        await tx.rollback();
        return { ok: false, message: "You cannot change your own role." };
      }
      if (currentRole === "super_admin" && isActive) {
        const others = await countOtherActiveSuperAdmins(tx, input.id);
        if (others === 0) {
          await tx.rollback();
          return {
            ok: false,
            message: "At least one active super admin must remain.",
          };
        }
      }
    }

    const changes: string[] = [];
    if (String(row.display_name) !== displayName) {
      changes.push(`name: ${String(row.display_name)} -> ${displayName}`);
    }
    if (role !== currentRole) {
      changes.push(`role: ${roleLabel(currentRole)} -> ${roleLabel(role)}`);
    }

    if (changes.length === 0) {
      await tx.commit();
      return { ok: true, message: "No changes to save." };
    }

    await tx.execute({
      sql: "UPDATE admins SET display_name = ?, role = ? WHERE id = ?",
      args: [displayName, role, input.id],
    });
    await writeAudit(
      tx,
      actor,
      "admin.updated",
      `@${String(row.username)} — ${changes.join("; ")}`,
    );
    await tx.commit();
    return { ok: true };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Already closed.
    }
    throw error;
  }
}

export async function setAdminActive(
  input: { id: number; active: boolean },
  actor: AdminActor,
): Promise<AdminActionResult> {
  const db = await ensureDb();
  const tx = await db.transaction("write");

  try {
    const current = await tx.execute({
      sql: "SELECT id, username, display_name, role, is_active FROM admins WHERE id = ?",
      args: [input.id],
    });
    const row = current.rows[0];
    if (!row) {
      await tx.rollback();
      return { ok: false, message: "Account not found." };
    }

    const isActive = Number(row.is_active) === 1;
    if (isActive === input.active) {
      await tx.commit();
      return { ok: true };
    }

    if (!input.active && input.id === actor.id) {
      await tx.rollback();
      return { ok: false, message: "You cannot deactivate your own account." };
    }

    if (!input.active && parseRole(row.role) === "super_admin" && isActive) {
      const others = await countOtherActiveSuperAdmins(tx, input.id);
      if (others === 0) {
        await tx.rollback();
        return {
          ok: false,
          message: "At least one active super admin must remain.",
        };
      }
    }

    await tx.execute({
      sql: `UPDATE admins
            SET is_active = ?,
                session_version = session_version + ?
            WHERE id = ?`,
      args: [input.active ? 1 : 0, input.active ? 0 : 1, input.id],
    });
    await writeAudit(
      tx,
      actor,
      input.active ? "admin.reactivated" : "admin.deactivated",
      `@${String(row.username)} (${String(row.display_name)})`,
    );
    await tx.commit();
    return { ok: true };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Already closed.
    }
    throw error;
  }
}

export async function resetAdminPassword(
  input: { id: number },
  actor: AdminActor,
): Promise<{ ok: true; tempPassword: string } | { ok: false; message: string }> {
  if (input.id === actor.id) {
    return {
      ok: false,
      message: "Use My account to change your own password.",
    };
  }

  const target = await getAdminById(input.id);
  if (!target) return { ok: false, message: "Account not found." };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const db = await ensureDb();
  const tx = await db.transaction("write");
  try {
    await tx.execute({
      sql: `UPDATE admins
            SET password_hash = ?,
                must_change_password = 1,
                password_changed_at = datetime('now'),
                session_version = session_version + 1
            WHERE id = ?`,
      args: [passwordHash, input.id],
    });
    await writeAudit(
      tx,
      actor,
      "admin.password_reset",
      `Reset password for @${target.username} (${target.displayName})`,
    );
    await tx.commit();
    return { ok: true, tempPassword };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Already closed.
    }
    throw error;
  }
}

export async function changeOwnPassword(input: {
  id: number;
  currentPassword: string;
  newPassword: string;
}): Promise<
  { ok: true; sessionVersion: number } | { ok: false; message: string }
> {
  const passwordError = validatePassword(input.newPassword);
  if (passwordError) return { ok: false, message: passwordError };

  if (input.currentPassword === input.newPassword) {
    return { ok: false, message: "Choose a password different from the current one." };
  }

  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT id, username, display_name, password_hash FROM admins WHERE id = ? LIMIT 1",
    args: [input.id],
  });
  const row = result.rows[0];
  if (!row) return { ok: false, message: "Account not found." };

  const valid = await verifyPassword(
    input.currentPassword,
    String(row.password_hash),
  );
  if (!valid) return { ok: false, message: "Current password is incorrect." };

  const passwordHash = await hashPassword(input.newPassword);
  const updated = await db.execute({
    sql: `UPDATE admins
          SET password_hash = ?,
              must_change_password = 0,
              password_changed_at = datetime('now'),
              session_version = session_version + 1
          WHERE id = ?
          RETURNING session_version`,
    args: [passwordHash, input.id],
  });

  await writeAudit(
    db,
    { id: input.id, displayName: String(row.display_name || row.username) },
    "admin.password_changed",
    `Changed own password (@${String(row.username)})`,
  );

  return {
    ok: true,
    sessionVersion: Number(updated.rows[0]?.session_version ?? 1),
  };
}

export async function updateOwnProfile(input: {
  id: number;
  displayName: string;
}): Promise<AdminActionResult> {
  const displayName = input.displayName.trim();
  const nameError = validateDisplayName(displayName);
  if (nameError) return { ok: false, message: nameError };

  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT username, display_name FROM admins WHERE id = ? LIMIT 1",
    args: [input.id],
  });
  const row = result.rows[0];
  if (!row) return { ok: false, message: "Account not found." };

  if (String(row.display_name) === displayName) {
    return { ok: true, message: "No changes to save." };
  }

  await db.execute({
    sql: "UPDATE admins SET display_name = ? WHERE id = ?",
    args: [displayName, input.id],
  });
  await writeAudit(
    db,
    { id: input.id, displayName },
    "admin.updated",
    `@${String(row.username)} — name: ${String(row.display_name)} -> ${displayName}`,
  );

  return { ok: true };
}
