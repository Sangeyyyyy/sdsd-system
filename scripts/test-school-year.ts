import fs from "node:fs";
import path from "node:path";

/**
 * School-year gating test against a throwaway SQLite database.
 *
 * Verifies that a roster is scoped to one school year, that Student IDs carry
 * the matching year prefix, and that only the active year can look students
 * up or book. Previous years stay on disk for history.
 *
 * Run with: npm run test:year
 */

const dbPath = path.join(process.cwd(), "data", "test-year.db");
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
  DEFAULT_SCHOOL_YEAR,
  normalizeSchoolYear,
  schoolYearStart,
  studentNoMatchesYear,
} = await import("../src/lib/school-year");
const { createStudent, updateStudent } = await import("../src/lib/students");
const { lookupStudent } = await import("../src/lib/booking");
const { getSettings, updateSettings } = await import("../src/lib/settings");
const {
  countStudents,
  getDashboard,
  listStudentYears,
  listStudents,
} = await import("../src/lib/queries");

const db = await ensureDb();
const actor = { id: 1, displayName: "Test Admin" };

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

check("default school year is 2026-2027", DEFAULT_SCHOOL_YEAR === "2026-2027");
check("school year is normalized", normalizeSchoolYear(" 2027 - 2028 ") === "2027-2028");
check("non-consecutive years are rejected", normalizeSchoolYear("2027-2029") === null);
check("start year is extracted", schoolYearStart("2027-2028") === "2027");
check("ID prefix matches its year", studentNoMatchesYear("2027-00001", "2027-2028"));
check("ID prefix mismatch is detected", !studentNoMatchesYear("2026-00001", "2027-2028"));

const settings = await getSettings();
check("settings start on the default year", settings.activeSchoolYear === "2026-2027");

const current = await createStudent(
  {
    studentNo: "2026-00001",
    firstName: "Maria",
    lastName: "Santos",
    program: "BSIT",
    yearLevel: 1,
    campus: "MAIN",
  },
  actor,
);
check("current-year student is created", current.ok, current.ok ? "" : current.message);
if (!current.ok) {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}
check("new student gets the active year", current.student.schoolYear === "2026-2027");

const mismatched = await createStudent(
  {
    studentNo: "2026-00002",
    firstName: "Wrong",
    lastName: "Year",
    program: "BSIT",
    yearLevel: 1,
    campus: "MAIN",
    schoolYear: "2027-2028",
  },
  actor,
);
check("ID that does not match the year is rejected", !mismatched.ok);

const incoming = await createStudent(
  {
    studentNo: "2027-00001",
    firstName: "Juan",
    lastName: "Dela Cruz",
    program: "BSIT",
    yearLevel: 1,
    campus: "MAIN",
    schoolYear: "2027-2028",
  },
  actor,
);
check("next-year student is created", incoming.ok, incoming.ok ? "" : incoming.message);
if (!incoming.ok) {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}
check("explicit school year is saved", incoming.student.schoolYear === "2027-2028");

const foundCurrent = await lookupStudent("2026-00001", "Santos");
check("active-year student can be found", foundCurrent !== null);

const hiddenNext = await lookupStudent("2027-00001", "Dela Cruz");
check("next-year student cannot be found yet", hiddenNext === null);

const renamed = await updateStudent(
  current.student.id,
  {
    studentNo: "2026-00001",
    firstName: "Maria",
    lastName: "Reyes",
    program: "BSIT",
    yearLevel: 2,
    campus: "MAIN",
  },
  actor,
);
check("student can still be edited", renamed.ok, renamed.ok ? "" : renamed.message);
if (renamed.ok) {
  check("edit keeps the school year", renamed.student.schoolYear === "2026-2027");
}

const moved = await updateStudent(
  current.student.id,
  {
    studentNo: "2026-00001",
    firstName: "Maria",
    lastName: "Reyes",
    program: "BSIT",
    yearLevel: 2,
    campus: "MAIN",
    schoolYear: "2027-2028",
  },
  actor,
);
check("edit cannot move a student to another year", !moved.ok);

const wrongPrefix = await updateStudent(
  current.student.id,
  {
    studentNo: "2027-00009",
    firstName: "Maria",
    lastName: "Reyes",
    program: "BSIT",
    yearLevel: 2,
    campus: "MAIN",
  },
  actor,
);
check("edit cannot change the ID year prefix", !wrongPrefix.ok);

const activeRows = await listStudents("", 50, 0);
check("roster defaults to the active year", activeRows.length === 1);
check("roster shows the active student", activeRows[0]?.studentNo === "2026-00001");

const allRows = await listStudents("", 50, 0, "all");
check("history view shows every year", allRows.length === 2);

const nextYearRows = await listStudents("", 50, 0, "2027-2028");
check("a specific year can be listed", nextYearRows.length === 1);
check("the listed row belongs to that year", nextYearRows[0]?.studentNo === "2027-00001");

check("active count only includes the active year", (await countStudents("")) === 1);
check("all-years count includes history", (await countStudents("", "all")) === 2);

const years = await listStudentYears();
check("both years are listed", years.length === 2);
check("years are newest first", years[0] === "2027-2028" && years[1] === "2026-2027");

const dashboardBefore = await getDashboard();
check("dashboard counts only active students", dashboardBefore.totals.students === 1);
check("dashboard campus counts follow the year", dashboardBefore.totals.main === 1);

await updateSettings({ activeSchoolYear: "2027-2028" });
const settingsAfter = await getSettings();
check("active year can be switched", settingsAfter.activeSchoolYear === "2027-2028");

const foundNext = await lookupStudent("2027-00001", "Dela Cruz");
check("new active year can be found", foundNext !== null);

const hiddenOld = await lookupStudent("2026-00001", "Reyes");
check("previous year can no longer be found", hiddenOld === null);

const dashboardAfter = await getDashboard();
check("dashboard follows the new active year", dashboardAfter.totals.students === 1);

const newDefault = await createStudent(
  {
    studentNo: "2027-00002",
    firstName: "Ana",
    lastName: "Reyes",
    program: "BSCS",
    yearLevel: 1,
    campus: "SAMAL",
  },
  actor,
);
check("manual add follows the new active year", newDefault.ok && newDefault.student.schoolYear === "2027-2028");

const dashboardSamal = await getDashboard();
check("dashboard counts the new SAMAL student", dashboardSamal.totals.samal === 1);

const row = await db.execute("SELECT COUNT(*) AS n FROM students WHERE school_year = '2026-2027'");
check("previous-year records are kept", Number(row.rows[0].n) === 1);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
