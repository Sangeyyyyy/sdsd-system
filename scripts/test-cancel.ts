import fs from "node:fs";
import path from "node:path";

/**
 * Student self-cancel test against a throwaway SQLite database.
 *
 * Verifies that a booked student can release their slot from the pass page,
 * that the day counter and audit trail are updated, and that verified,
 * past, or unknown appointments cannot be cancelled.
 *
 * Run with: npm run test:cancel
 */

const dbPath = path.join(process.cwd(), "data", "test-cancel.db");
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  try {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  } catch {
    // Ignore.
  }
}

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";

const { ensureDb } = await import("../src/lib/db");
const { updateSettings, ensureHorizon, getDayCapacity } = await import(
  "../src/lib/settings"
);
const { bookAppointment, cancelAppointmentByStudent, getAppointmentById } =
  await import("../src/lib/booking");
const { todayISO, addDays } = await import("../src/lib/dates");
const { normalizeFirstName, normalizeLastName } = await import(
  "../src/lib/names"
);

const db = await ensureDb();
await updateSettings({
  dailyLimit: 10,
  samalEnabled: false,
  bookingOpen: true,
  sameDayCutoffHour: 23,
  maxRebooks: 3,
});
await ensureHorizon(30);

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function addStudent(studentNo: string, first: string, last: string) {
  const result = await db.execute({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
          VALUES (?, ?, '', ?, ?, 'BSIT', 1, 'MAIN', ?, ?)
          RETURNING id`,
    args: [
      studentNo,
      first,
      last,
      `${first} ${last}`,
      normalizeFirstName(first),
      normalizeLastName(last),
    ],
  });
  return Number(result.rows[0].id);
}

const studentId = await addStudent("2026-20001", "Cancel", "Tester");
const booking = await bookAppointment({
  studentNo: "2026-20001",
  lastName: "Tester",
  consent: true,
});

check("student can book", booking.ok, booking.ok ? "" : booking.message);
if (!booking.ok) {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}

const appointmentId = booking.appointment.id;
const reference = booking.appointment.referenceCode;
const date = booking.appointment.date;

const capacityBefore = await getDayCapacity(date);
check(
  "slot is counted as booked",
  capacityBefore?.booked === 1,
  String(capacityBefore?.booked),
);

const cancelled = await cancelAppointmentByStudent(reference);
check("student cancels their booking", cancelled.ok, cancelled.ok ? "" : cancelled.message);

const stored = await getAppointmentById(appointmentId);
check("appointment is marked cancelled", stored?.status === "cancelled");

const capacityAfter = await getDayCapacity(date);
check(
  "slot is released",
  capacityAfter?.booked === 0,
  String(capacityAfter?.booked),
);

const audit = await db.execute({
  sql: `SELECT admin_id, details FROM audit_log
        WHERE appointment_id = ? AND action = 'status:cancelled'
        ORDER BY id DESC LIMIT 1`,
  args: [appointmentId],
});
check("cancellation is audited", audit.rows.length === 1);
check(
  "audit is attributed to the student, not an admin",
  audit.rows.length === 1 && audit.rows[0].admin_id === null,
);
check(
  "audit details mention the student",
  audit.rows.length === 1 &&
    String(audit.rows[0].details).includes("by student"),
);

const again = await cancelAppointmentByStudent(reference);
check("cancelling twice is harmless", again.ok);

const rebook = await bookAppointment({
  studentNo: "2026-20001",
  lastName: "Tester",
  consent: true,
});
check("student can book again after cancelling", rebook.ok);

if (rebook.ok) {
  await db.execute({
    sql: "UPDATE appointments SET status = 'verified' WHERE id = ?",
    args: [rebook.appointment.id],
  });
  const verifiedCancel = await cancelAppointmentByStudent(
    rebook.appointment.referenceCode,
  );
  check("verified appointment cannot be cancelled", !verifiedCancel.ok);
}

const pastDate = addDays(todayISO(), -3);
const past = await db.execute({
  sql: `INSERT INTO appointments
          (student_id, appointment_date, queue_number, status, reference_code, consent_at)
        VALUES (?, ?, 900, 'booked', 'SDSD-PAST01', datetime('now'))
        RETURNING id`,
  args: [studentId, pastDate],
});
const pastCancel = await cancelAppointmentByStudent("SDSD-PAST01");
check("past appointment cannot be cancelled", !pastCancel.ok);
const pastStored = await getAppointmentById(Number(past.rows[0].id));
check("past appointment stays booked", pastStored?.status === "booked");

const unknown = await cancelAppointmentByStudent("SDSD-NOPE99");
check("unknown reference is rejected", !unknown.ok);

const empty = await cancelAppointmentByStudent("   ");
check("empty reference is rejected", !empty.ok);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
