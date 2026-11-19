import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

/**
 * Roster replacement test against a throwaway SQLite database.
 *
 * Verifies the yearly rollover: the active cohort's outstanding bookings are
 * cancelled, empty records are deleted, records with history are archived,
 * the new roster becomes active, and history stays viewable.
 *
 * Run with: npm run test:roster-replace
 */

const dbPath = path.join(process.cwd(), "data", "test-roster-replace.db");
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
  ensureDefaultSettings,
  getSettings,
  updateSettings,
} = await import("../src/lib/settings");
const {
  ROSTER_COLUMNS,
  ROSTER_SHEET_NAME,
  applyRosterImport,
  listRosterImports,
  parseRosterBuffer,
  previewRosterImport,
} = await import("../src/lib/roster-import");
const { lookupStudent } = await import("../src/lib/booking");
const {
  countStudents,
  getDashboard,
  listStudents,
} = await import("../src/lib/queries");

const db = await ensureDb();
await ensureDefaultSettings();
const actor = { id: 0, displayName: "Test import" };

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

async function roster(
  schoolYear: string,
  rows: Array<[string, string, string]>,
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(ROSTER_SHEET_NAME);
  sheet.addRow(ROSTER_COLUMNS.map((column) => column.header));
  for (const [studentNo, first, last] of rows) {
    sheet.addRow([studentNo, first, "", last, "BSIT", "1", "MAIN", schoolYear]);
  }
  const buffer = await book.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

async function addStudent(
  studentNo: string,
  first: string,
  last: string,
  schoolYear = "2026-2027",
): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, school_year, match_first, match_last)
          VALUES (?, ?, '', ?, ?, 'BSIT', 1, 'MAIN', ?, ?, ?)
          RETURNING id`,
    args: [
      studentNo,
      first,
      last,
      `${first} ${last}`,
      schoolYear,
      first.toUpperCase(),
      last.toUpperCase(),
    ],
  });
  return Number(result.rows[0].id);
}

async function addAppointment(
  studentId: number,
  date: string,
  status: "booked" | "verified",
  reference: string,
): Promise<number> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO day_capacity (date, booked, issued, capacity)
          VALUES (?, 1, 1, 200)`,
    args: [date],
  });
  const result = await db.execute({
    sql: `INSERT INTO appointments
            (student_id, appointment_date, queue_number, status, reference_code)
          VALUES (?, ?, 1, ?, ?)
          RETURNING id`,
    args: [studentId, date, status, reference],
  });
  return Number(result.rows[0].id);
}

// --- Seed the outgoing cohort --------------------------------------------

const emptyId = await addStudent("2026-00001", "Empty", "Record");
const historyId = await addStudent("2026-00002", "Has", "History");
const bookedId = await addStudent("2026-00003", "Has", "Booking");

const verifiedDate = "2026-12-01";
const bookedDate = "2026-12-02";
await addAppointment(historyId, verifiedDate, "verified", "SDSD-HIST0001");
const bookedAppointmentId = await addAppointment(
  bookedId,
  bookedDate,
  "booked",
  "SDSD-BOOK0001",
);

check("three outgoing students are seeded", (await countStudents("", "all")) === 3);

// --- Preview -------------------------------------------------------------

const nextRoster = await roster("2027-2028", [
  ["2027-00001", "Juan", "Dela Cruz"],
  ["2027-00002", "Maria", "Santos"],
]);
const parsed = await parseRosterBuffer(nextRoster, "2027-2028");
check("next roster parses", parsed.ok, parsed.errors.map((e) => e.message).join("; "));

const preview = await previewRosterImport(parsed);
check("preview sees two new students", preview.newStudents === 2, String(preview.newStudents));
check("preview sees no updates", preview.updatedStudents === 0);
check("preview sees three outgoing", preview.outgoingStudents === 3, String(preview.outgoingStudents));
check("preview keeps two with history", preview.outgoingWithHistory === 2, String(preview.outgoingWithHistory));
check("preview deletes one empty record", preview.outgoingWithoutHistory === 1);
check("preview counts the booking to cancel", preview.outstandingBookings === 1);
check("preview can apply", preview.canApply);

// --- Apply ---------------------------------------------------------------

const summary = await applyRosterImport(parsed, {
  schoolYear: "2027-2028",
  filename: "roster-2027-2028.xlsx",
  actor,
  mode: "replace",
});

check("two students imported", summary.imported === 2, String(summary.imported));
check("one empty record deleted", summary.deleted === 1, String(summary.deleted));
check("two records archived", summary.archived === 2, String(summary.archived));
check("one booking cancelled", summary.cancelledBookings === 1, String(summary.cancelledBookings));

const settings = await getSettings();
check("active year switched", settings.activeSchoolYear === "2027-2028", settings.activeSchoolYear);

const emptyRow = await db.execute({
  sql: "SELECT id FROM students WHERE id = ?",
  args: [emptyId],
});
check("student without history is deleted", emptyRow.rows.length === 0);

const archived = await db.execute({
  sql: "SELECT id, school_year, is_active FROM students WHERE id IN (?, ?) ORDER BY id",
  args: [historyId, bookedId],
});
check("records with history are kept", archived.rows.length === 2);
check(
  "kept records are inactive",
  archived.rows.every((row) => Number(row.is_active) === 0),
);
check(
  "kept records keep their old school year",
  archived.rows.every((row) => String(row.school_year) === "2026-2027"),
);

const bookedRow = await db.execute({
  sql: "SELECT status FROM appointments WHERE id = ?",
  args: [bookedAppointmentId],
});
check("outstanding booking is cancelled", String(bookedRow.rows[0]?.status) === "cancelled");

const verifiedRow = await db.execute({
  sql: "SELECT status FROM appointments WHERE student_id = ?",
  args: [historyId],
});
check("verified history is untouched", String(verifiedRow.rows[0]?.status) === "verified");

const capacityRow = await db.execute({
  sql: "SELECT booked FROM day_capacity WHERE date = ?",
  args: [bookedDate],
});
check("cancelled booking releases the slot", Number(capacityRow.rows[0]?.booked) === 0);
const verifiedCapacity = await db.execute({
  sql: "SELECT booked FROM day_capacity WHERE date = ?",
  args: [verifiedDate],
});
check("verified day keeps its count", Number(verifiedCapacity.rows[0]?.booked) === 1);

const foundNew = await lookupStudent("2027-00001", "Dela Cruz");
check("new student can be found", foundNew !== null);
const foundArchived = await lookupStudent("2026-00003", "Booking");
check("archived student cannot be found", foundArchived === null);

check("active roster has the new cohort", (await countStudents("")) === 2);
check("all-years roster keeps history", (await countStudents("", "all")) === 4);
check("previous-year view shows archived records", (await countStudents("", "2026-2027")) === 2);

const oldRows = await listStudents("", 50, 0, "2026-2027");
check("archived records are still listed", oldRows.length === 2, String(oldRows.length));

const dashboard = await getDashboard();
check("dashboard counts the new cohort", dashboard.totals.students === 2, String(dashboard.totals.students));

const imports = await listRosterImports();
check("import is recorded", imports.length === 1);
check("import records the year", imports[0]?.schoolYear === "2027-2028");
check("import records the filename", imports[0]?.filename === "roster-2027-2028.xlsx");
check("import records the counts", imports[0]?.imported === 2 && imports[0]?.deleted === 1 && imports[0]?.archived === 2);

const audit = await db.execute(
  "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'roster.imported'",
);
check("import is audited", Number(audit.rows[0].n) === 1);
const cancelAudit = await db.execute(
  "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'status:cancelled' AND appointment_id = ?",
  [bookedAppointmentId],
);
check("cancelled booking is audited", Number(cancelAudit.rows[0].n) === 1);

// --- Same-year re-import ------------------------------------------------

const reimportId = await db.execute({
  sql: "SELECT id FROM students WHERE student_no = '2027-00002'",
});
const reimportStudentId = Number(reimportId.rows[0].id);
await addAppointment(reimportStudentId, "2026-12-03", "verified", "SDSD-HIST0002");

const corrected = await roster("2027-2028", [
  ["2027-00001", "Juan", "Dela Cruz"],
]);
const correctedParsed = await parseRosterBuffer(corrected, "2027-2028");
const correctedPreview = await previewRosterImport(correctedParsed);
check("same-year re-import updates the survivor", correctedPreview.updatedStudents === 1);
check("same-year re-import has no new students", correctedPreview.newStudents === 0);
check("same-year re-import sees one outgoing", correctedPreview.outgoingStudents === 1);

const correctedSummary = await applyRosterImport(correctedParsed, {
  schoolYear: "2027-2028",
  filename: "correction.xlsx",
  actor,
});
check("same-year re-import archives the removed student", correctedSummary.archived === 1);
check("same-year re-import deletes nothing with history", correctedSummary.deleted === 0);

const removed = await db.execute({
  sql: "SELECT is_active FROM students WHERE id = ?",
  args: [reimportStudentId],
});
check("removed student is marked inactive", Number(removed.rows[0]?.is_active) === 0);
const removedLookup = await lookupStudent("2027-00002", "Santos");
check("removed student cannot book", removedLookup === null);
const survivor = await lookupStudent("2027-00001", "Dela Cruz");
check("surviving student can still book", survivor !== null);

// --- Merge mode ----------------------------------------------------------

const merged = await roster("2028-2029", [
  ["2028-00001", "New", "Cohort"],
]);
const mergedParsed = await parseRosterBuffer(merged, "2028-2029");
const mergedSummary = await applyRosterImport(mergedParsed, {
  schoolYear: "2028-2029",
  filename: "roster-2028-2029.xlsx",
  actor,
  mode: "merge",
});
check("merge imports the new roster", mergedSummary.imported === 1);
check("merge deletes nobody", mergedSummary.deleted === 0);
check("merge archives nobody", mergedSummary.archived === 0);

const survivorStillThere = await db.execute({
  sql: "SELECT COUNT(*) AS n FROM students WHERE student_no = '2027-00001'",
});
check("merge keeps the previous cohort", Number(survivorStillThere.rows[0].n) === 1);
check("merge switches the active year", (await getSettings()).activeSchoolYear === "2028-2029");

// --- Invalid import ------------------------------------------------------

let threw = false;
try {
  await applyRosterImport(
    { ...parsed, ok: false },
    { schoolYear: "2027-2028", filename: "bad.xlsx", actor },
  );
} catch {
  threw = true;
}
check("invalid parse cannot be applied", threw);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
