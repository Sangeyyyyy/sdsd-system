import { ensureDb } from "./db";

export const AUDIT_PAGE_SIZE = 50;

export type AuditEntry = {
  id: number;
  adminId: number | null;
  adminName: string | null;
  adminUsername: string | null;
  action: string;
  appointmentId: number | null;
  details: string;
  createdAt: string;
};

export type AuditFilters = {
  adminId?: number | null;
  action?: string | null;
  from?: string | null;
  to?: string | null;
};

export type AuditActor = {
  id: number;
  displayName: string;
  username: string;
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.created": "Account created",
  "admin.updated": "Account updated",
  "admin.deactivated": "Account deactivated",
  "admin.reactivated": "Account reactivated",
  "admin.password_reset": "Password reset",
  "admin.password_changed": "Password changed",
  "status:booked": "Marked as booked",
  "status:verified": "Verified",
  "status:no_show": "Marked as no-show",
  "status:cancelled": "Cancelled",
  "student.created": "Student added",
  "student.updated": "Student updated",
  "bookings.reset": "Bookings reset",
  "settings.updated": "Settings updated",
  "settings.blocked_date_added": "Date blocked",
  "settings.blocked_date_removed": "Date unblocked",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/**
 * Appends an audit entry for actions that are not tied to a single
 * appointment (settings, blocked dates, maintenance).
 */
export async function recordAudit(
  actor: { id: number; displayName: string },
  action: string,
  details: string,
): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "INSERT INTO audit_log (admin_id, action, appointment_id, details) VALUES (?, ?, NULL, ?)",
    args: [actor.id, action, details],
  });
}

function buildWhere(filters: AuditFilters): {
  clause: string;
  args: Array<string | number>;
} {
  const conditions: string[] = [];
  const args: Array<string | number> = [];

  if (filters.adminId) {
    conditions.push("a.admin_id = ?");
    args.push(filters.adminId);
  }
  if (filters.action) {
    conditions.push("a.action = ?");
    args.push(filters.action);
  }
  // Timestamps are stored in UTC; compare against Manila calendar days.
  if (filters.from) {
    conditions.push("date(a.created_at, '+8 hours') >= ?");
    args.push(filters.from);
  }
  if (filters.to) {
    conditions.push("date(a.created_at, '+8 hours') <= ?");
    args.push(filters.to);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    args,
  };
}

export async function listAuditEntries(
  filters: AuditFilters,
  page = 1,
): Promise<AuditEntry[]> {
  const db = await ensureDb();
  const { clause, args } = buildWhere(filters);
  const offset = Math.max(0, page - 1) * AUDIT_PAGE_SIZE;

  const result = await db.execute({
    sql: `SELECT a.id, a.admin_id, a.action, a.appointment_id, a.details, a.created_at,
                 ad.display_name AS admin_name, ad.username AS admin_username
          FROM audit_log a
          LEFT JOIN admins ad ON ad.id = a.admin_id
          ${clause}
          ORDER BY a.id DESC
          LIMIT ? OFFSET ?`,
    args: [...args, AUDIT_PAGE_SIZE, offset],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    adminId: row.admin_id === null ? null : Number(row.admin_id),
    adminName: row.admin_name ? String(row.admin_name) : null,
    adminUsername: row.admin_username ? String(row.admin_username) : null,
    action: String(row.action),
    appointmentId: row.appointment_id === null ? null : Number(row.appointment_id),
    details: String(row.details ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function countAuditEntries(
  filters: AuditFilters,
): Promise<number> {
  const db = await ensureDb();
  const { clause, args } = buildWhere(filters);
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM audit_log a ${clause}`,
    args,
  });
  return Number(result.rows[0]?.n ?? 0);
}

export async function listAuditActors(): Promise<AuditActor[]> {
  const db = await ensureDb();
  const result = await db.execute(
    `SELECT DISTINCT ad.id, ad.display_name, ad.username
     FROM audit_log a
     JOIN admins ad ON ad.id = a.admin_id
     ORDER BY ad.display_name ASC`,
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    displayName: String(row.display_name || row.username),
    username: String(row.username),
  }));
}

export async function listAuditActions(): Promise<
  Array<{ action: string; count: number }>
> {
  const db = await ensureDb();
  const result = await db.execute(
    `SELECT action, COUNT(*) AS n FROM audit_log GROUP BY action ORDER BY action ASC`,
  );
  return result.rows.map((row) => ({
    action: String(row.action),
    count: Number(row.n),
  }));
}
