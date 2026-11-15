import fs from "node:fs";
import path from "node:path";

/**
 * End-to-end booking test against a throwaway SQLite database.
 *
 * Run with: npm run test:booking
 */

const dbPath = path.join(process.cwd(), "data", "test-booking.db");
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
const {
  updateSettings,
  getSettings,
  ensureHorizon,
  addBlockedDate,
} = await import("../src/lib/settings");
const {
  bookAppointment,
  lookupStudent,
  getAppointmentByReference,
} = await import("../src/lib/booking");
const { setAppointmentStatus, getDayStats } = await import("../src/lib/queries");
const { todayISO, isOfficeDay } = await import("../src/lib/dates");
const { normalizeFirstName, normalizeLastName } = await import(
  "../src/lib/names"
);

const db = await ensureDb();
await updateSettings({
  dailyLimit: 2,
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

async function addStudent(
  studentNo: string,
  first: string,
  last: string,
  campus: "MAIN" | "SAMAL" = "MAIN",
) {
  await db.execute({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
          VALUES (?, ?, '', ?, ?, 'BSIT', 1, ?, ?, ?)`,
    args: [
      studentNo,
      first,
      last,
      `${first} ${last}`,
      campus,
      normalizeFirstName(first),
      normalizeLastName(last),
    ],
  });
}

await addStudent("2026-00001", "STUDENT ONE", "ALPHA");
await addStudent("2026-00002", "STUDENT TWO", "BRAVO");
await addStudent("2026-00003", "STUDENT THREE", "CHARLIE");
await addStudent("2026-00004", "SAMAL FOUR", "DELTA", "SAMAL");
await addStudent("2026-00005", "REBOOK FIVE", "ECHO");
await addStudent("2026-00006", "BLOCKED SIX", "FOXTROT");

const today = todayISO();
const settings = await getSettings();
check("daily limit applied", settings.dailyLimit === 2, String(settings.dailyLimit));
check("SAMAL starts disabled", settings.samalEnabled === false);

const first = await bookAppointment({
  studentNo: "2026-00001",
  lastName: "Alpha",
  consent: true,
});
if (!first.ok) throw new Error(`first booking failed: ${first.message}`);
check("first booking succeeds", first.ok);
check("first queue number is 1", first.appointment.queueNumber === 1);
check(
  "assigned date is an office day",
  isOfficeDay(first.appointment.date),
  first.appointment.date,
);
check("assigned date is not in the past", first.appointment.date >= today);
check(
  "reference code has the SDSD prefix",
  first.appointment.referenceCode.startsWith("SDSD-"),
);
const date1 = first.appointment.date;

const duplicate = await bookAppointment({
  studentNo: "2026-00001",
  lastName: "Alpha",
  consent: true,
});
if (!duplicate.ok) throw new Error("duplicate booking should return existing");
check("duplicate booking is idempotent", duplicate.alreadyBooked === true);
check(
  "duplicate booking keeps the same appointment",
  duplicate.appointment.id === first.appointment.id,
);

const second = await bookAppointment({
  studentNo: "2026-00002",
  lastName: "Bravo",
  consent: true,
});
if (!second.ok) throw new Error(`second booking failed: ${second.message}`);
check("second booking gets queue 2", second.appointment.queueNumber === 2);
check("second booking uses the same day", second.appointment.date === date1);

const third = await bookAppointment({
  studentNo: "2026-00003",
  lastName: "Charlie",
  consent: true,
});
if (!third.ok) throw new Error(`third booking failed: ${third.message}`);
check("third booking rolls to the next day", third.appointment.date !== date1);
check("next day starts at queue 1", third.appointment.queueNumber === 1);
const date2 = third.appointment.date;

const samalBlocked = await bookAppointment({
  studentNo: "2026-00004",
  lastName: "Delta",
  consent: true,
});
check(
  "SAMAL is blocked while disabled",
  !samalBlocked.ok && samalBlocked.code === "campus_closed",
);

await updateSettings({ samalEnabled: true });
const samal = await bookAppointment({
  studentNo: "2026-00004",
  lastName: "Delta",
  consent: true,
});
if (!samal.ok) throw new Error(`SAMAL booking failed: ${samal.message}`);
check("SAMAL books after enabling the toggle", samal.ok);

const lookup = await lookupStudent("2026-00001", "Alpha");
check("lookup finds the student", lookup !== null);
check("lookup shows an active booking", lookup?.state.status === "booked");

const noShow = await setAppointmentStatus(
  first.appointment.id,
  "no_show",
  { id: 1, displayName: "Test Admin" },
);
check("admin can mark a no-show", noShow.ok);

const afterNoShow = await lookupStudent("2026-00001", "Alpha");
check(
  "student can rebook after a no-show",
  afterNoShow?.state.status === "new",
  afterNoShow?.state.status,
);

const rebook = await bookAppointment({
  studentNo: "2026-00001",
  lastName: "Alpha",
  consent: true,
});
if (!rebook.ok) throw new Error(`rebook failed: ${rebook.message}`);
check("rebook succeeds", rebook.ok);
check("rebook returns to the earliest open day", rebook.appointment.date === date1);
check("rebook issues a new queue number", rebook.appointment.queueNumber === 3);

const byReference = await getAppointmentByReference(
  rebook.appointment.referenceCode.toLowerCase(),
);
check(
  "reference lookup is case-insensitive",
  byReference?.id === rebook.appointment.id,
);

const day1Stats = await getDayStats(date1);
check("day 1 capacity is full", day1Stats.slotsRemaining === 0);
check("day 1 has two active bookings", day1Stats.slotsBooked === 2);

await updateSettings({ maxRebooks: 1 });
const fifth = await bookAppointment({
  studentNo: "2026-00005",
  lastName: "Echo",
  consent: true,
});
if (!fifth.ok) throw new Error(`fifth booking failed: ${fifth.message}`);
await setAppointmentStatus(fifth.appointment.id, "no_show", {
  id: 1,
  displayName: "Test Admin",
});
const fifthRebook = await bookAppointment({
  studentNo: "2026-00005",
  lastName: "Echo",
  consent: true,
});
check("one rebook is allowed", fifthRebook.ok);
if (fifthRebook.ok) {
  await setAppointmentStatus(fifthRebook.appointment.id, "no_show", {
    id: 1,
    displayName: "Test Admin",
  });
}
const overLimit = await bookAppointment({
  studentNo: "2026-00005",
  lastName: "Echo",
  consent: true,
});
check(
  "rebooking stops at the configured limit",
  !overLimit.ok && overLimit.code === "rebook_limit",
);

await addBlockedDate(date1, "Test holiday");
const blocked = await bookAppointment({
  studentNo: "2026-00006",
  lastName: "Foxtrot",
  consent: true,
});
if (!blocked.ok) throw new Error(`blocked-date booking failed: ${blocked.message}`);
check("blocked dates are skipped", blocked.appointment.date !== date1);
check("blocked booking lands on a later day", blocked.appointment.date > date1);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
