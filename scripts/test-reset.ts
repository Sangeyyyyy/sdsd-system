import fs from "node:fs";
import path from "node:path";

/**
 * Reset-bookings test against a throwaway SQLite database.
 *
 * Verifies that `resetAllBookings` deletes every appointment, zeroes the day
 * counters, keeps the roster, writes an audit entry, and lets a student who
 * previously used a rebooking book again.
 *
 * Run with: npm run test:reset
 */

const dbPath = path.join(process.cwd(), "data", "test-reset.db");
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
const { ensureHorizon, getDayCapacity, updateSettings } = await import(
  "../src/lib/settings"
);
const { bookAppointment } = await import("../src/lib/booking");
const { resetAllBookings } = await import("../src/lib/maintenance");
const { todayISO } = await import("../src/lib/dates");
const { normalizeFirstName, normalizeLastName } = await import(
  "../src/lib/names"
);

const db = await ensureDb();
await updateSettings({
  dailyLimit: 200,
  samalEnabled: false,
  bookingOpen: true,
  sameDayCutoffHour: 23,
  maxRebooks: 3,
});
await ensureHorizon(30);

const today = todayISO();
await db.execute({
  sql: "INSERT OR IGNORE INTO day_capacity (date, booked, issued, capacity) VALUES (?, 0, 0, 200)",
  args: [today],
});

const student = await db.execute({
  sql: `INSERT INTO students
          (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
        VALUES ('2026-09999', 'TEST', '', 'STUDENT', 'TEST STUDENT', 'BSIT', 1, 'MAIN', ?, ?)
        RETURNING id`,
  args: [normalizeFirstName("TEST"), normalizeLastName("STUDENT")],
});
const studentId = Number(student.rows[0].id);

await db.execute({
  sql: `INSERT INTO appointments
          (student_id, appointment_date, queue_number, status, reference_code, consent_at)
        VALUES (?, ?, 1, 'no_show', 'SDSD-TEST01', datetime('now'))`,
  args: [studentId, today],
});
await db.execute({
  sql: `INSERT INTO appointments
          (student_id, appointment_date, queue_number, status, reference_code, consent_at)
        VALUES (?, ?, 2, 'verified', 'SDSD-TEST02', datetime('now'))`,
  args: [studentId, today],
});
await db.execute({
  sql: "UPDATE day_capacity SET booked = 2, issued = 1 WHERE date = ?",
  args: [today],
});

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

const before = await db.execute("SELECT COUNT(*) AS n FROM appointments");
const capBefore = await getDayCapacity(today);
check("two appointments seeded", Number(before.rows[0].n) === 2);
check(
  "day counters seeded",
  capBefore?.booked === 2 && capBefore?.issued === 1,
  JSON.stringify(capBefore),
);

const result = await resetAllBookings({ id: 1, displayName: "Test Admin" });
const after = await db.execute("SELECT COUNT(*) AS n FROM appointments");
const students = await db.execute("SELECT COUNT(*) AS n FROM students");
const capAfter = await getDayCapacity(today);
const audit = await db.execute(
  "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'bookings.reset'",
);

check("reset reports both appointments", result.appointments === 2);
check("appointments cleared", Number(after.rows[0].n) === 0);
check("students kept", Number(students.rows[0].n) === 1);
check("booked counter reset", capAfter?.booked === 0);
check("issued counter reset", capAfter?.issued === 0);
check("audit entry written", Number(audit.rows[0].n) === 1);

const rebook = await bookAppointment({
  studentNo: "2026-09999",
  lastName: "Student",
  consent: true,
});
check(
  "student can book again after reset",
  rebook.ok,
  rebook.ok ? "" : rebook.message,
);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
