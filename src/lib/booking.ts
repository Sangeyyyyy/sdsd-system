import type { Row, Transaction } from "@libsql/client";
import { ensureDb } from "./db";
import { getSettings, ensureHorizon } from "./settings";
import {
  addDays,
  isOfficeDay,
  manilaHour,
  nextOfficeDay,
  todayISO,
} from "./dates";
import {
  normalizeLastName,
  normalizeStudentNo,
} from "./names";
import { newReferenceCode, normalizeReferenceCode } from "./reference";

export type AppointmentStatus = "booked" | "verified" | "no_show" | "cancelled";

export type StudentRecord = {
  id: number;
  studentNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  fullName: string;
  program: string;
  yearLevel: number;
  campus: string;
  matchFirst: string;
  matchLast: string;
};

export type AppointmentView = {
  id: number;
  studentId: number;
  studentNo: string;
  fullName: string;
  program: string;
  campus: string;
  date: string;
  queueNumber: number;
  status: AppointmentStatus;
  referenceCode: string;
  bookedAt: string;
  verifiedAt: string | null;
};

function rowToStudent(row: Row): StudentRecord {
  return {
    id: Number(row.id),
    studentNo: String(row.student_no),
    firstName: String(row.first_name),
    middleInitial: String(row.middle_initial ?? ""),
    lastName: String(row.last_name),
    fullName: String(row.full_name),
    program: String(row.program),
    yearLevel: Number(row.year_level ?? 1),
    campus: String(row.campus ?? "MAIN"),
    matchFirst: String(row.match_first),
    matchLast: String(row.match_last),
  };
}

function rowToAppointment(row: Row): AppointmentView {
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
  };
}

const APPOINTMENT_SELECT = `
  SELECT a.*, s.student_no, s.full_name, s.program, s.campus
  FROM appointments a
  JOIN students s ON s.id = a.student_id
`;

export async function findStudentByCredentials(
  studentNo: string,
  lastName: string,
): Promise<StudentRecord | null> {
  const db = await ensureDb();
  const no = normalizeStudentNo(studentNo);
  const last = normalizeLastName(lastName);
  if (!no || !last) return null;

  const result = await db.execute({
    sql: "SELECT * FROM students WHERE student_no = ? AND match_last = ? LIMIT 1",
    args: [no, last],
  });
  const row = result.rows[0];
  return row ? rowToStudent(row) : null;
}

export async function getStudentByNo(
  studentNo: string,
): Promise<StudentRecord | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT * FROM students WHERE student_no = ? LIMIT 1",
    args: [normalizeStudentNo(studentNo)],
  });
  const row = result.rows[0];
  return row ? rowToStudent(row) : null;
}

/**
 * A booking left open past its date means the student did not show up. We
 * flip it lazily when the student interacts with the system so they can
 * rebook without waiting for staff to clean up yesterday's list.
 */
export async function expireStaleBookings(studentId: number): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "UPDATE appointments SET status = 'no_show' WHERE student_id = ? AND status = 'booked' AND appointment_date < ?",
    args: [studentId, todayISO()],
  });
}

export async function getStudentState(studentId: number): Promise<{
  appointments: AppointmentView[];
  active: AppointmentView | null;
  verified: AppointmentView | null;
  noShowCount: number;
}> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `${APPOINTMENT_SELECT} WHERE a.student_id = ? ORDER BY a.id DESC`,
    args: [studentId],
  });
  const appointments = result.rows.map(rowToAppointment);
  return {
    appointments,
    active: appointments.find((item) => item.status === "booked") ?? null,
    verified: appointments.find((item) => item.status === "verified") ?? null,
    noShowCount: appointments.filter((item) => item.status === "no_show").length,
  };
}

export async function getAppointmentById(
  id: number,
): Promise<AppointmentView | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `${APPOINTMENT_SELECT} WHERE a.id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToAppointment(row) : null;
}

export async function getAppointmentByReference(
  reference: string,
): Promise<AppointmentView | null> {
  const db = await ensureDb();
  const code = normalizeReferenceCode(reference);
  if (!code) return null;
  const result = await db.execute({
    sql: `${APPOINTMENT_SELECT} WHERE UPPER(a.reference_code) = ? LIMIT 1`,
    args: [code],
  });
  const row = result.rows[0];
  return row ? rowToAppointment(row) : null;
}

export type LookupResult = {
  student: {
    studentNo: string;
    firstName: string;
    middleInitial: string;
    lastName: string;
    fullName: string;
    program: string;
    campus: string;
  };
  state: {
    status: "new" | "booked" | "verified" | "blocked";
    message: string;
    canBook: boolean;
    noShowCount: number;
    maxRebooks: number;
    nextAvailableDate: string | null;
    active: AppointmentView | null;
    verifiedAppointment: AppointmentView | null;
  };
};

export async function lookupStudent(
  studentNo: string,
  lastName: string,
): Promise<LookupResult | null> {
  const student = await findStudentByCredentials(studentNo, lastName);
  if (!student) return null;

  const settings = await getSettings();
  await expireStaleBookings(student.id);
  const state = await getStudentState(student.id);

  let status: LookupResult["state"]["status"] = "new";
  let message = "You are eligible to book an appointment.";
  let canBook = true;
  let nextAvailableDate: string | null = null;

  if (state.verified) {
    status = "verified";
    canBook = false;
    message = "Your ID has already been verified. No appointment is needed.";
  } else if (state.active) {
    status = "booked";
    canBook = false;
    message = "You already have a booked appointment.";
  } else if (student.campus === "SAMAL" && !settings.samalEnabled) {
    status = "blocked";
    canBook = false;
    message = "Booking for the SAMAL campus is not open yet.";
  } else if (!settings.bookingOpen) {
    status = "blocked";
    canBook = false;
    message = "Booking is temporarily closed. Please check back later.";
  } else if (state.noShowCount > settings.maxRebooks) {
    status = "blocked";
    canBook = false;
    message = `You have reached the maximum of ${settings.maxRebooks} rebookings. Please visit the SDSD office.`;
  } else {
    nextAvailableDate = await getNextOpenDate();
  }

  return {
    student: {
      studentNo: student.studentNo,
      firstName: student.firstName,
      middleInitial: student.middleInitial,
      lastName: student.lastName,
      fullName: student.fullName,
      program: student.program,
      campus: student.campus,
    },
    state: {
      status,
      message,
      canBook,
      noShowCount: state.noShowCount,
      maxRebooks: settings.maxRebooks,
      nextAvailableDate,
      active: state.active,
      verifiedAppointment: state.verified,
    },
  };
}

export type BookResult =
  | { ok: true; appointment: AppointmentView; alreadyBooked: boolean }
  | { ok: false; code: string; message: string };

function fail(code: string, message: string): BookResult {
  return { ok: false, code, message };
}

/**
 * The earliest date a student may book. Same-day booking is allowed until
 * the configured cutoff hour (default 3:00 PM Manila).
 */
export function bookingStartDate(cutoffHour: number): string {
  const today = todayISO();
  if (!isOfficeDay(today)) return nextOfficeDay(today, false);
  if (manilaHour() >= cutoffHour) return nextOfficeDay(addDays(today, 1), true);
  return today;
}

async function takeSlot(
  tx: Transaction,
  start: string,
): Promise<{ date: string; queue: number } | null> {
  const excluded = new Set<string>();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const exclusionSql =
      excluded.size > 0
        ? ` AND date NOT IN (${Array.from(excluded).map(() => "?").join(", ")})`
        : "";
    const selected = await tx.execute({
      sql: `SELECT date FROM day_capacity
            WHERE date >= ? AND booked < capacity
              AND date NOT IN (SELECT date FROM blocked_dates)
              ${exclusionSql}
            ORDER BY date ASC LIMIT 1`,
      args: [start, ...Array.from(excluded)],
    });

    if (selected.rows.length === 0) return null;

    const date = String(selected.rows[0].date);
    const updated = await tx.execute({
      sql: "UPDATE day_capacity SET booked = booked + 1, issued = issued + 1 WHERE date = ? AND booked < capacity RETURNING issued",
      args: [date],
    });

    if (updated.rows.length > 0) {
      return { date, queue: Number(updated.rows[0].issued) };
    }
    excluded.add(date);
  }

  return null;
}

async function newUniqueReference(tx: Transaction): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = newReferenceCode();
    const existing = await tx.execute({
      sql: "SELECT 1 FROM appointments WHERE reference_code = ? LIMIT 1",
      args: [code],
    });
    if (existing.rows.length === 0) return code;
  }
  throw new Error("Unable to generate a unique reference code");
}

/**
 * Earliest date with at least one free slot, or null when the whole horizon is
 * full or blocked. Used for public messaging and the dashboard.
 */
export async function getNextOpenDate(): Promise<string | null> {
  const settings = await getSettings();
  await ensureHorizon();
  const start = bookingStartDate(settings.sameDayCutoffHour);
  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT date FROM day_capacity
          WHERE date >= ? AND booked < capacity
            AND date NOT IN (SELECT date FROM blocked_dates)
          ORDER BY date ASC LIMIT 1`,
    args: [start],
  });
  return result.rows[0] ? String(result.rows[0].date) : null;
}

export async function bookAppointment(input: {
  studentNo: string;
  lastName: string;
  consent: boolean;
}): Promise<BookResult> {
  await ensureDb();

  if (!input.consent) {
    return fail(
      "consent",
      "Please agree to the Data Privacy Notice before booking.",
    );
  }

  const settings = await getSettings();
  if (!settings.bookingOpen) {
    return fail("closed", "Booking is temporarily closed. Please check back later.");
  }

  const student = await findStudentByCredentials(input.studentNo, input.lastName);
  if (!student) {
    return fail(
      "not_found",
      "We could not find that Student ID and last name. Please check and try again.",
    );
  }

  if (student.campus === "SAMAL" && !settings.samalEnabled) {
    return fail("campus_closed", "Booking for the SAMAL campus is not open yet.");
  }

  await expireStaleBookings(student.id);
  const state = await getStudentState(student.id);

  if (state.verified) {
    return fail(
      "verified",
      "Your ID has already been verified. No appointment is needed.",
    );
  }
  if (state.active) {
    return { ok: true, appointment: state.active, alreadyBooked: true };
  }
  if (state.noShowCount > settings.maxRebooks) {
    return fail(
      "rebook_limit",
      `You have reached the maximum of ${settings.maxRebooks} rebookings. Please visit the SDSD office.`,
    );
  }

  await ensureHorizon();
  const start = bookingStartDate(settings.sameDayCutoffHour);
  const db = await ensureDb();
  const tx = await db.transaction("write");

  let createdId: number | null = null;
  let existingId: number | null = null;

  try {
    // Re-check inside the write transaction so two requests cannot both win.
    const activeRows = await tx.execute({
      sql: "SELECT id FROM appointments WHERE student_id = ? AND status = 'booked' ORDER BY id DESC LIMIT 1",
      args: [student.id],
    });

    if (activeRows.rows.length > 0) {
      existingId = Number(activeRows.rows[0].id);
      await tx.commit();
    } else {
      const verifiedRows = await tx.execute({
        sql: "SELECT 1 FROM appointments WHERE student_id = ? AND status = 'verified' LIMIT 1",
        args: [student.id],
      });
      if (verifiedRows.rows.length > 0) {
        await tx.rollback();
        return fail(
          "verified",
          "Your ID has already been verified. No appointment is needed.",
        );
      }

      const noShowRows = await tx.execute({
        sql: "SELECT COUNT(*) AS n FROM appointments WHERE student_id = ? AND status = 'no_show'",
        args: [student.id],
      });
      const noShowCount = Number(noShowRows.rows[0]?.n ?? 0);
      if (noShowCount > settings.maxRebooks) {
        await tx.rollback();
        return fail(
          "rebook_limit",
          `You have reached the maximum of ${settings.maxRebooks} rebookings. Please visit the SDSD office.`,
        );
      }

      const slot = await takeSlot(tx, start);
      if (!slot) {
        await tx.rollback();
        return fail(
          "full",
          "All available appointment slots are full right now. Please try again later.",
        );
      }

      const reference = await newUniqueReference(tx);
      const inserted = await tx.execute({
        sql: `INSERT INTO appointments
                (student_id, appointment_date, queue_number, status, reference_code, consent_at)
              VALUES (?, ?, ?, 'booked', ?, datetime('now'))
              RETURNING id`,
        args: [student.id, slot.date, slot.queue, reference],
      });
      createdId = Number(inserted.rows[0].id);
      await tx.commit();
    }
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Transaction may already be closed after commit/rollback.
    }
    throw error;
  }

  if (existingId !== null) {
    const appointment = await getAppointmentById(existingId);
    if (appointment) {
      return { ok: true, appointment, alreadyBooked: true };
    }
    return fail("error", "Could not load your appointment. Please try again.");
  }

  if (createdId !== null) {
    const appointment = await getAppointmentById(createdId);
    if (appointment) {
      return { ok: true, appointment, alreadyBooked: false };
    }
    return fail(
      "error",
      "Your booking was saved but could not be loaded. Please contact the SDSD office.",
    );
  }

  return fail("error", "Something went wrong. Please try again.");
}

export type CancelResult = { ok: true } | { ok: false; message: string };

/**
 * Lets a student cancel their own upcoming appointment from the pass page.
 *
 * No admin account is involved, so the audit entry is recorded against the
 * system (`admin_id` NULL) and the day's booked counter is released for
 * someone else.
 */
export async function cancelAppointmentByStudent(
  reference: string,
): Promise<CancelResult> {
  const code = normalizeReferenceCode(reference);
  if (!code) {
    return { ok: false, message: "Enter a valid reference code." };
  }

  const db = await ensureDb();
  const tx = await db.transaction("write");

  try {
    const result = await tx.execute({
      sql: `SELECT id, appointment_date, status
            FROM appointments
            WHERE UPPER(reference_code) = ?
            LIMIT 1`,
      args: [code],
    });

    const row = result.rows[0];
    if (!row) {
      await tx.rollback();
      return { ok: false, message: "Appointment not found." };
    }

    const appointmentId = Number(row.id);
    const status = String(row.status) as AppointmentStatus;
    const date = String(row.appointment_date);

    if (status === "cancelled") {
      await tx.commit();
      return { ok: true };
    }

    if (status !== "booked") {
      await tx.rollback();
      return {
        ok: false,
        message: "Only an upcoming booked appointment can be cancelled.",
      };
    }

    if (date < todayISO()) {
      await tx.rollback();
      return {
        ok: false,
        message: "This appointment date has already passed.",
      };
    }

    await tx.execute({
      sql: `UPDATE appointments
            SET status = 'cancelled', verified_at = NULL, verified_by = NULL
            WHERE id = ?`,
      args: [appointmentId],
    });

    await tx.execute({
      sql: `UPDATE day_capacity
            SET booked = CASE WHEN booked > 0 THEN booked - 1 ELSE 0 END
            WHERE date = ?`,
      args: [date],
    });

    await tx.execute({
      sql: `INSERT INTO audit_log (admin_id, action, appointment_id, details)
            VALUES (NULL, 'status:cancelled', ?, ?)`,
      args: [appointmentId, "booked -> cancelled by student"],
    });

    await tx.commit();
    return { ok: true };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Transaction may already be closed after commit/rollback.
    }
    throw error;
  }
}
