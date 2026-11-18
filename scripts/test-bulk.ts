import fs from "node:fs";
import path from "node:path";

/**
 * Bulk status test against a throwaway SQLite database.
 *
 * Verifies that several appointments can be verified, cancelled, and restored
 * in one call, that capacity counters follow the batch, and that each
 * appointment keeps its own audit entry.
 *
 * Run with: npm run test:bulk
 */

const dbPath = path.join(process.cwd(), "data", "test-bulk.db");
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
const { bookAppointment, getAppointmentById } = await import(
  "../src/lib/booking"
);
const { setAppointmentsStatus, getDayStats } = await import(
  "../src/lib/queries"
);
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

const admin = { id: 1, displayName: "Test Admin" };

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
  await db.execute({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
          VALUES (?, ?, '', ?, ?, 'BSIT', 1, 'MAIN', ?, ?)`,
    args: [
      studentNo,
      first,
      last,
      `${first} ${last}`,
      normalizeFirstName(first),
      normalizeLastName(last),
    ],
  });
}

const people = [
  ["2026-30001", "Bulk", "One"],
  ["2026-30002", "Bulk", "Two"],
  ["2026-30003", "Bulk", "Three"],
] as const;

for (const [studentNo, first, last] of people) {
  await addStudent(studentNo, first, last);
}

const ids: number[] = [];
let date = "";

for (const [studentNo, , last] of people) {
  const booking = await bookAppointment({
    studentNo,
    lastName: last,
    consent: true,
  });
  if (!booking.ok) {
    console.error(`  FAIL  setup booking for ${studentNo}: ${booking.message}`);
    process.exit(1);
  }
  ids.push(booking.appointment.id);
  date = booking.appointment.date;
}

const capacityBefore = await getDayCapacity(date);
check("three slots booked", capacityBefore?.booked === 3);

const verified = await setAppointmentsStatus(ids, "verified", admin);
check("bulk verify reports all three", verified.ok && verified.updated === 3);
check("no failures reported", verified.failed === 0);

let stats = await getDayStats(date);
check("three verified", stats.verified === 3, String(stats.verified));
check("none left booked", stats.booked === 0, String(stats.booked));
const capacityVerified = await getDayCapacity(date);
check(
  "verifying keeps the slot counted",
  capacityVerified?.booked === 3,
  String(capacityVerified?.booked),
);

const cancelled = await setAppointmentsStatus(ids, "cancelled", admin);
check("bulk cancel reports all three", cancelled.ok && cancelled.updated === 3);

stats = await getDayStats(date);
check("three cancelled", stats.cancelled === 3, String(stats.cancelled));
const capacityCancelled = await getDayCapacity(date);
check(
  "cancelling releases the slots",
  capacityCancelled?.booked === 0,
  String(capacityCancelled?.booked),
);

const audit = await db.execute({
  sql: `SELECT COUNT(*) AS n FROM audit_log
        WHERE action = 'status:cancelled'
          AND appointment_id IN (?, ?, ?)`,
  args: ids,
});
check("each appointment is audited", Number(audit.rows[0].n) === 3);

const restored = await setAppointmentsStatus(ids, "booked", admin);
check("bulk restore reports all three", restored.ok && restored.updated === 3);
const capacityRestored = await getDayCapacity(date);
check("restoring reclaims the slots", capacityRestored?.booked === 3);

const deduped = await setAppointmentsStatus(
  [ids[0], ids[0], ids[0]],
  "verified",
  admin,
);
check(
  "duplicate ids are handled once",
  deduped.ok && deduped.updated === 1,
  JSON.stringify(deduped),
);

const unknown = await setAppointmentsStatus([999999], "verified", admin);
check(
  "unknown ids are reported as failures",
  !unknown.ok && unknown.updated === 0 && unknown.failed === 1,
  JSON.stringify(unknown),
);

const mixed = await setAppointmentsStatus(
  [ids[1], 999999],
  "no_show",
  admin,
);
check(
  "a stale row does not roll back the batch",
  mixed.updated === 1 && mixed.failed === 1,
  JSON.stringify(mixed),
);
const mixedStored = await getAppointmentById(ids[1]);
check("the valid row was updated", mixedStored?.status === "no_show");

const invalid = await setAppointmentsStatus(
  ids,
  "unknown" as never,
  admin,
);
check("unknown status is rejected", !invalid.ok && invalid.updated === 0);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
