import type { Row, Transaction } from "@libsql/client";
import { ensureDb } from "./db";
import {
  getSettings,
  ensureHorizon,
  getDayCapacity,
} from "./settings";
import { todayISO } from "./dates";
import type {
  AppointmentStatus,
  AppointmentView,
  StudentRecord,
} from "./booking";

export type AdminAppointment = AppointmentView & {
  verifiedBy: string | null;
  consentAt: string | null;
};

export type DayStats = {
  date: string;
  capacity: number;
  slotsBooked: number;
  slotsRemaining: number;
  booked: number;
  verified: number;
  noShow: number;
  cancelled: number;
  total: number;
};

function rowToAdminAppointment(row: Row): AdminAppointment {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    studentNo: String(row.student_no),
    fullName: String(row.full_name),
    program: String(row.program),
    campus: String(row.campus ?? "MAIN"),
    date: String(row.appointment_date),
    queueNumber: Number(row.queue_number),
    status: String(row.status) as AppointmentStatus,
    referenceCode: String(row.reference_code),
    bookedAt: String(row.booked_at ?? ""),
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    consentAt: row.consent_at ? String(row.consent_at) : null,
  };
}

export async function getDayStats(date: string): Promise<DayStats> {
  const db = await ensureDb();
  const settings = await getSettings();

  const [capacity, counts] = await Promise.all([
    getDayCapacity(date),
    db.execute({
      sql: `SELECT
              COALESCE(SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END), 0) AS booked,
              COALESCE(SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END), 0) AS verified,
              COALESCE(SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END), 0) AS no_show,
              COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
              COUNT(*) AS total
            FROM appointments WHERE appointment_date = ?`,
      args: [date],
    }),
  ]);

  const row = counts.rows[0];
  const slotsBooked = capacity?.booked ?? 0;
  const cap = capacity?.capacity ?? settings.dailyLimit;

  return {
    date,
    capacity: cap,
    slotsBooked,
    slotsRemaining: Math.max(0, cap - slotsBooked),
    booked: Number(row?.booked ?? 0),
    verified: Number(row?.verified ?? 0),
    noShow: Number(row?.no_show ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    total: Number(row?.total ?? 0),
  };
}

export type DashboardData = {
  today: string;
  todayStats: DayStats;
  totals: {
    students: number;
    main: number;
    samal: number;
    appointments: number;
    verified: number;
    noShow: number;
  };
  upcoming: Array<{
    date: string;
    capacity: number;
    booked: number;
    verified: number;
    noShow: number;
    blocked: boolean;
  }>;
  samalEnabled: boolean;
  dailyLimit: number;
};

export async function getDashboard(): Promise<DashboardData> {
  const db = await ensureDb();
  await ensureHorizon(90);
  const settings = await getSettings();
  const today = todayISO();

  const [totalsResult, upcomingResult, todayStats] = await Promise.all([
    db.execute({
      sql: `SELECT
        (SELECT COUNT(*) FROM students WHERE school_year = ?) AS students,
        (SELECT COUNT(*) FROM students WHERE campus = 'MAIN' AND school_year = ?) AS main,
        (SELECT COUNT(*) FROM students WHERE campus = 'SAMAL' AND school_year = ?) AS samal,
        (SELECT COUNT(*) FROM appointments) AS appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'verified') AS verified,
        (SELECT COUNT(*) FROM appointments WHERE status = 'no_show') AS no_show`,
      args: [
        settings.activeSchoolYear,
        settings.activeSchoolYear,
        settings.activeSchoolYear,
      ],
    }),
    db.execute({
      sql: `SELECT c.date, c.capacity, c.booked,
              (SELECT COUNT(*) FROM appointments a WHERE a.appointment_date = c.date AND a.status = 'verified') AS verified,
              (SELECT COUNT(*) FROM appointments a WHERE a.appointment_date = c.date AND a.status = 'no_show') AS no_show,
              (SELECT COUNT(*) FROM blocked_dates b WHERE b.date = c.date) AS blocked
            FROM day_capacity c
            WHERE c.date >= ?
            ORDER BY c.date ASC
            LIMIT 10`,
      args: [today],
    }),
    getDayStats(today),
  ]);

  const totalsRow = totalsResult.rows[0];
  return {
    today,
    todayStats,
    totals: {
      students: Number(totalsRow?.students ?? 0),
      main: Number(totalsRow?.main ?? 0),
      samal: Number(totalsRow?.samal ?? 0),
      appointments: Number(totalsRow?.appointments ?? 0),
      verified: Number(totalsRow?.verified ?? 0),
      noShow: Number(totalsRow?.no_show ?? 0),
    },
    upcoming: upcomingResult.rows.map((row) => ({
      date: String(row.date),
      capacity: Number(row.capacity),
      booked: Number(row.booked),
      verified: Number(row.verified),
      noShow: Number(row.no_show),
      blocked: Number(row.blocked) > 0,
    })),
    samalEnabled: settings.samalEnabled,
    dailyLimit: settings.dailyLimit,
  };
}

export type AppointmentFilter = {
  date?: string;
  from?: string;
  to?: string;
  query?: string;
  status?: string;
  campus?: string;
  queue?: number;
  limit?: number;
  offset?: number;
};

const VALID_STATUSES = new Set([
  "booked",
  "verified",
  "no_show",
  "cancelled",
]);
const VALID_CAMPUSES = new Set(["MAIN", "SAMAL"]);

function buildAppointmentWhere(filter: AppointmentFilter): {
  where: string;
  args: Array<string | number>;
} {
  const conditions: string[] = [];
  const args: Array<string | number> = [];

  if (filter.date) {
    conditions.push("a.appointment_date = ?");
    args.push(filter.date);
  }
  if (filter.from) {
    conditions.push("a.appointment_date >= ?");
    args.push(filter.from);
  }
  if (filter.to) {
    conditions.push("a.appointment_date <= ?");
    args.push(filter.to);
  }
  if (filter.status && VALID_STATUSES.has(filter.status)) {
    conditions.push("a.status = ?");
    args.push(filter.status);
  }
  if (filter.campus && VALID_CAMPUSES.has(filter.campus)) {
    conditions.push("s.campus = ?");
    args.push(filter.campus);
  }
  if (filter.queue !== undefined && Number.isInteger(filter.queue)) {
    conditions.push("a.queue_number = ?");
    args.push(filter.queue);
  }
  if (filter.query && filter.query.trim()) {
    const like = `%${filter.query.trim()}%`;
    conditions.push(
      "(s.student_no LIKE ? OR s.full_name LIKE ? OR a.reference_code LIKE ?)",
    );
    args.push(like, like, like);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    args,
  };
}

export async function listAppointments(
  filter: AppointmentFilter = {},
): Promise<AdminAppointment[]> {
  const db = await ensureDb();
  const { where, args } = buildAppointmentWhere(filter);
  const limit = Math.min(5000, Math.max(1, filter.limit ?? 100));
  const offset = Math.max(0, filter.offset ?? 0);

  const result = await db.execute({
    sql: `SELECT a.*, s.student_no, s.full_name, s.program, s.campus
          FROM appointments a
          JOIN students s ON s.id = a.student_id
          ${where}
          ORDER BY a.appointment_date ASC, a.queue_number ASC
          LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  return result.rows.map(rowToAdminAppointment);
}

export async function countAppointments(
  filter: AppointmentFilter = {},
): Promise<number> {
  const db = await ensureDb();
  const { where, args } = buildAppointmentWhere(filter);
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n
          FROM appointments a
          JOIN students s ON s.id = a.student_id
          ${where}`,
    args,
  });
  return Number(result.rows[0]?.n ?? 0);
}

export type StudentListItem = StudentRecord & {
  lastStatus: AppointmentStatus | null;
  bookedDate: string | null;
  bookedQueue: number | null;
  bookedReference: string | null;
  noShowCount: number;
};

export async function listStudents(
  query: string,
  limit = 25,
  offset = 0,
  schoolYear = "active",
): Promise<StudentListItem[]> {
  const db = await ensureDb();
  const trimmed = query.trim();
  const conditions: string[] = [];
  const args: Array<string | number> = [];

  if (trimmed) {
    conditions.push(
      "(s.student_no LIKE ? OR s.full_name LIKE ? OR s.program LIKE ?)",
    );
    args.push(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`);
  }

  const yearFilter =
    schoolYear === "all"
      ? null
      : schoolYear === "active"
        ? (await getSettings()).activeSchoolYear
        : schoolYear;
  if (yearFilter) {
    conditions.push("s.school_year = ?");
    args.push(yearFilter);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.execute({
    sql: `SELECT s.*,
            (SELECT a.status FROM appointments a WHERE a.student_id = s.id ORDER BY a.id DESC LIMIT 1) AS last_status,
            (SELECT a.appointment_date FROM appointments a WHERE a.student_id = s.id AND a.status = 'booked' ORDER BY a.id DESC LIMIT 1) AS booked_date,
            (SELECT a.queue_number FROM appointments a WHERE a.student_id = s.id AND a.status = 'booked' ORDER BY a.id DESC LIMIT 1) AS booked_queue,
            (SELECT a.reference_code FROM appointments a WHERE a.student_id = s.id AND a.status = 'booked' ORDER BY a.id DESC LIMIT 1) AS booked_reference,
            (SELECT COUNT(*) FROM appointments a WHERE a.student_id = s.id AND a.status = 'no_show') AS no_show_count
          FROM students s
          ${where}
          ORDER BY s.last_name ASC, s.first_name ASC
          LIMIT ? OFFSET ?`,
    args: [...args, Math.min(200, Math.max(1, limit)), Math.max(0, offset)],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    studentNo: String(row.student_no),
    firstName: String(row.first_name),
    middleInitial: String(row.middle_initial ?? ""),
    lastName: String(row.last_name),
    fullName: String(row.full_name),
    program: String(row.program),
    yearLevel: Number(row.year_level ?? 1),
    campus: String(row.campus ?? "MAIN"),
    schoolYear: String(row.school_year ?? ""),
    matchFirst: String(row.match_first),
    matchLast: String(row.match_last),
    lastStatus: row.last_status
      ? (String(row.last_status) as AppointmentStatus)
      : null,
    bookedDate: row.booked_date ? String(row.booked_date) : null,
    bookedQueue: row.booked_queue !== null && row.booked_queue !== undefined
      ? Number(row.booked_queue)
      : null,
    bookedReference: row.booked_reference ? String(row.booked_reference) : null,
    noShowCount: Number(row.no_show_count ?? 0),
  }));
}

export async function countStudents(
  query: string,
  schoolYear = "active",
): Promise<number> {
  const db = await ensureDb();
  const trimmed = query.trim();
  const conditions: string[] = [];
  const args: Array<string | number> = [];

  if (trimmed) {
    conditions.push(
      "(student_no LIKE ? OR full_name LIKE ? OR program LIKE ?)",
    );
    args.push(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`);
  }

  const yearFilter =
    schoolYear === "all"
      ? null
      : schoolYear === "active"
        ? (await getSettings()).activeSchoolYear
        : schoolYear;
  if (yearFilter) {
    conditions.push("school_year = ?");
    args.push(yearFilter);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM students ${where}`,
    args,
  });
  return Number(result.rows[0]?.n ?? 0);
}

/** Every school year present on the roster, newest first. */
export async function listStudentYears(): Promise<string[]> {
  const db = await ensureDb();
  const result = await db.execute(
    "SELECT DISTINCT school_year FROM students WHERE school_year <> '' ORDER BY school_year DESC",
  );
  return result.rows.map((row) => String(row.school_year));
}

async function adjustBooked(
  tx: Transaction,
  date: string,
  delta: 1 | -1,
): Promise<void> {
  const existing = await tx.execute({
    sql: "SELECT date FROM day_capacity WHERE date = ? LIMIT 1",
    args: [date],
  });

  if (existing.rows.length === 0) {
    await tx.execute({
      sql: "INSERT OR IGNORE INTO day_capacity (date, booked, issued, capacity) VALUES (?, 0, 0, ?)",
      args: [date, 1],
    });
  }

  if (delta > 0) {
    await tx.execute({
      sql: "UPDATE day_capacity SET booked = booked + 1 WHERE date = ?",
      args: [date],
    });
  } else {
    await tx.execute({
      sql: "UPDATE day_capacity SET booked = CASE WHEN booked > 0 THEN booked - 1 ELSE 0 END WHERE date = ?",
      args: [date],
    });
  }
}

export async function setAppointmentStatus(
  appointmentId: number,
  next: AppointmentStatus,
  admin: { id: number; displayName: string },
): Promise<{ ok: boolean; message?: string }> {  if (!VALID_STATUSES.has(next)) {
    return { ok: false, message: "Unknown status." };
  }

  const db = await ensureDb();
  const tx = await db.transaction("write");

  try {
    const currentResult = await tx.execute({
      sql: "SELECT id, appointment_date, status FROM appointments WHERE id = ?",
      args: [appointmentId],
    });
    if (currentResult.rows.length === 0) {
      await tx.rollback();
      return { ok: false, message: "Appointment not found." };
    }

    const current = currentResult.rows[0];
    const currentStatus = String(current.status) as AppointmentStatus;
    const date = String(current.appointment_date);

    if (currentStatus === next) {
      await tx.commit();
      return { ok: true };
    }

    const countsOld = currentStatus === "booked" || currentStatus === "verified";
    const countsNew = next === "booked" || next === "verified";

    await tx.execute({
      sql: `UPDATE appointments
            SET status = ?,
                verified_at = CASE WHEN ? = 'verified' THEN datetime('now') ELSE NULL END,
                verified_by = CASE WHEN ? = 'verified' THEN ? ELSE NULL END
            WHERE id = ?`,
      args: [next, next, next, admin.displayName, appointmentId],
    });

    if (countsOld && !countsNew) {
      await adjustBooked(tx, date, -1);
    } else if (!countsOld && countsNew) {
      await adjustBooked(tx, date, 1);
    }

    await tx.execute({
      sql: "INSERT INTO audit_log (admin_id, action, appointment_id, details) VALUES (?, ?, ?, ?)",
      args: [
        admin.id,
        `status:${next}`,
        appointmentId,
        `${currentStatus} -> ${next} by ${admin.displayName}`,
      ],
    });

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

/**
 * Applies the same status to a batch of appointments. Each appointment keeps
 * its own transaction and audit entry, so a single stale row cannot roll back
 * the rest of the batch.
 */
export async function setAppointmentsStatus(
  ids: number[],
  next: AppointmentStatus,
  admin: { id: number; displayName: string },
): Promise<{ ok: boolean; updated: number; failed: number }> {
  if (!VALID_STATUSES.has(next)) {
    return { ok: false, updated: 0, failed: ids.length };
  }

  const unique = [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

  let updated = 0;
  let failed = 0;

  for (const id of unique) {
    const result = await setAppointmentStatus(id, next, admin);
    if (result.ok) updated += 1;
    else failed += 1;
  }

  return { ok: failed === 0, updated, failed };
}
