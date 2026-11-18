import fs from "node:fs";
import path from "node:path";

/**
 * Reports test against a throwaway SQLite database.
 *
 * Verifies range normalization and the summary, daily, program, and campus
 * aggregates that back `/admin/reports` and its CSV export.
 *
 * Run with: npm run test:reports
 */

const dbPath = path.join(process.cwd(), "data", "test-reports.db");
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
const { normalizeReportRange, getReport, REPORT_MAX_DAYS } = await import(
  "../src/lib/reports"
);
const { addDays, todayISO } = await import("../src/lib/dates");
const { normalizeFirstName, normalizeLastName } = await import(
  "../src/lib/names"
);

const db = await ensureDb();

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

const today = todayISO();
const defaults = normalizeReportRange(null, null);
check(
  "default range is the last 30 days",
  defaults.to === today && defaults.from === addDays(today, -29),
  JSON.stringify(defaults),
);

const swapped = normalizeReportRange("2026-05-20", "2026-05-01");
check(
  "reversed dates are swapped",
  swapped.from === "2026-05-01" && swapped.to === "2026-05-20",
  JSON.stringify(swapped),
);

const invalid = normalizeReportRange("nope", "2026-05-20");
check(
  "invalid from falls back to 30 days",
  invalid.to === "2026-05-20" && invalid.from === addDays("2026-05-20", -29),
  JSON.stringify(invalid),
);

const capped = normalizeReportRange("2020-01-01", "2026-05-20");
check(
  "range is capped at 366 days",
  capped.from === addDays(capped.to, -(REPORT_MAX_DAYS - 1)),
  JSON.stringify(capped),
);

async function addStudent(
  studentNo: string,
  first: string,
  last: string,
  program: string,
  campus: "MAIN" | "SAMAL",
) {
  const result = await db.execute({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
          VALUES (?, ?, '', ?, ?, ?, 1, ?, ?, ?)
          RETURNING id`,
    args: [
      studentNo,
      first,
      last,
      `${first} ${last}`,
      program,
      campus,
      normalizeFirstName(first),
      normalizeLastName(last),
    ],
  });
  return Number(result.rows[0].id);
}

async function addAppointment(
  studentId: number,
  date: string,
  queue: number,
  status: string,
  reference: string,
) {
  await db.execute({
    sql: `INSERT INTO appointments
            (student_id, appointment_date, queue_number, status, reference_code, consent_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    args: [studentId, date, queue, status, reference],
  });
}

const dayOne = "2026-05-04";
const dayTwo = "2026-05-05";

const ana = await addStudent("2026-40001", "Ana", "Reyes", "BSIT", "MAIN");
const ben = await addStudent("2026-40002", "Ben", "Cruz", "BSIT", "MAIN");
const cara = await addStudent("2026-40003", "Cara", "Lim", "BSSW", "SAMAL");

await addAppointment(ana, dayOne, 1, "verified", "SDSD-RPT01");
await addAppointment(ben, dayOne, 2, "no_show", "SDSD-RPT02");
await addAppointment(cara, dayTwo, 1, "verified", "SDSD-RPT03");
await addAppointment(ana, dayTwo, 2, "cancelled", "SDSD-RPT04");
await addAppointment(ben, "2026-06-01", 1, "booked", "SDSD-RPT05");

const report = await getReport({ from: "2026-05-01", to: "2026-05-31" });

check("summary counts all rows in range", report.summary.total === 4);
check("summary counts verified", report.summary.verified === 2);
check("summary counts no-shows", report.summary.noShow === 1);
check("summary counts cancellations", report.summary.cancelled === 1);
check("summary counts booked", report.summary.booked === 0);
check("summary counts unique students", report.summary.students === 3);
check("summary counts active days", report.summary.days === 2);

check("daily rows are grouped by date", report.byDay.length === 2);
check("daily rows are sorted", report.byDay[0]?.date === dayOne);
check(
  "first day has two appointments",
  report.byDay[0]?.total === 2,
  String(report.byDay[0]?.total),
);
check(
  "second day has one verification and one cancellation",
  report.byDay[1]?.verified === 1 && report.byDay[1]?.cancelled === 1,
);

const bsit = report.byProgram.find((group) => group.label === "BSIT");
const bssw = report.byProgram.find((group) => group.label === "BSSW");
check(
  "program totals are grouped",
  bsit?.total === 3 && bssw?.total === 1,
  JSON.stringify(report.byProgram),
);
check(
  "program status counts are correct",
  bsit?.verified === 1 && bsit?.noShow === 1 && bsit?.cancelled === 1,
);

const main = report.byCampus.find((group) => group.label === "MAIN");
const samal = report.byCampus.find((group) => group.label === "SAMAL");
check(
  "campus totals are grouped",
  main?.total === 3 && samal?.total === 1,
  JSON.stringify(report.byCampus),
);

const outside = await getReport({ from: "2026-07-01", to: "2026-07-31" });
check("empty range has zero total", outside.summary.total === 0);
check("empty range has no daily rows", outside.byDay.length === 0);
check("empty range has no groups", outside.byProgram.length === 0);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
