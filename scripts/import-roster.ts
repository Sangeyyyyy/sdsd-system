import "./env";
import ExcelJS from "exceljs";
import { ensureDb } from "../src/lib/db";
import { ensureDefaultSettings } from "../src/lib/settings";
import {
  buildFullName,
  normalizeFirstName,
  normalizeLastName,
  normalizeStudentNo,
} from "../src/lib/names";

const ROSTER_PATH = "excel/roster.xlsx";

const EXCLUDED_SHEETS = new Set([
  "INCOMPLETE",
  "SHEET1",
  "1 (2)",
  "BEHIND BARS",
]);

const SHEET_PROGRAM: Record<string, string> = {
  "SOCIAL WORK": "BSSW",
  ENTREP: "BS-ENTREP",
  BSCRIM: "CRIM",
};

type RosterRecord = {
  studentNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  fullName: string;
  program: string;
  yearLevel: number;
  campus: "MAIN" | "SAMAL";
  matchFirst: string;
  matchLast: string;
};

function cellText(cell: ExcelJS.Cell): string {
  return (cell.text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeProgram(raw: string, sheetName: string): string {
  const value = raw.toUpperCase().replace(/\s+/g, " ").trim();
  if (value) {
    return SHEET_PROGRAM[value] ?? value;
  }
  const sheet = sheetName.toUpperCase().replace(/\s+/g, " ").trim();
  return SHEET_PROGRAM[sheet] ?? (sheet === "SAMAL" ? "" : sheet);
}

function parseYear(raw: string): number | null {
  const match = raw.match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const fresh = process.argv.includes("--fresh");
  const force = process.argv.includes("--force");
  const db = await ensureDb();
  await ensureDefaultSettings();

  if (fresh) {
    const appointments = await db.execute(
      "SELECT COUNT(*) AS n FROM appointments",
    );
    if (Number(appointments.rows[0]?.n ?? 0) > 0 && !force) {
      console.error(
        "Refusing to reset: appointments already exist. Re-run with --fresh --force if you really want to wipe them.",
      );
      process.exit(1);
    }
    await db.batch(
      [
        "DELETE FROM appointments",
        "DELETE FROM students",
        "UPDATE day_capacity SET booked = 0, issued = 0",
      ],
      "write",
    );
    console.log("Cleared existing students and appointments.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(ROSTER_PATH);

  const records = new Map<string, RosterRecord>();
  const conflicts: string[] = [];
  const skipped: string[] = [];
  let totalRows = 0;
  let firstYearRows = 0;

  workbook.eachSheet((sheet) => {
    const sheetName = sheet.name.trim().toUpperCase();
    if (EXCLUDED_SHEETS.has(sheetName)) return;

    const campus: "MAIN" | "SAMAL" = sheetName === "SAMAL" ? "SAMAL" : "MAIN";

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 3) return;

      const programRaw = cellText(row.getCell(1));
      const studentNoRaw = cellText(row.getCell(2));
      const first = cellText(row.getCell(3));
      const middleInitial = cellText(row.getCell(4));
      const last = cellText(row.getCell(5));
      const yearRaw = cellText(row.getCell(7));

      if (!studentNoRaw && !first && !last) return;
      totalRows += 1;

      const yearLevel = parseYear(yearRaw);
      if (yearLevel !== 1) return;
      firstYearRows += 1;

      const studentNo = normalizeStudentNo(studentNoRaw);
      if (!/^\d{4}-\d{5}$/.test(studentNo)) {
        skipped.push(
          `${sheet.name} row ${rowNumber}: malformed ID "${studentNoRaw}" (${first} ${last})`,
        );
        return;
      }
      if (!first || !last) {
        skipped.push(
          `${sheet.name} row ${rowNumber}: missing name (ID ${studentNo})`,
        );
        return;
      }

      const program = normalizeProgram(programRaw, sheet.name);
      if (!program) {
        skipped.push(
          `${sheet.name} row ${rowNumber}: missing program (ID ${studentNo})`,
        );
        return;
      }

      const record: RosterRecord = {
        studentNo,
        firstName: first,
        middleInitial,
        lastName: last,
        fullName: buildFullName(first, middleInitial, last),
        program,
        yearLevel: 1,
        campus,
        matchFirst: normalizeFirstName(first),
        matchLast: normalizeLastName(last),
      };

      const existing = records.get(studentNo);
      if (!existing) {
        records.set(studentNo, record);
        return;
      }

      const sameName =
        existing.matchFirst === record.matchFirst &&
        existing.matchLast === record.matchLast;

      if (!sameName) {
        conflicts.push(
          `ID ${studentNo}: kept "${existing.fullName}" (${existing.campus}), skipped "${record.fullName}" (${record.campus})`,
        );
        return;
      }

      // Same person listed twice. Prefer the SAMAL row when present.
      if (existing.campus === "MAIN" && record.campus === "SAMAL") {
        records.set(studentNo, record);
      }
    });
  });

  const all = Array.from(records.values());
  const statements = all.map((record) => ({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(student_no) DO UPDATE SET
            first_name = excluded.first_name,
            middle_initial = excluded.middle_initial,
            last_name = excluded.last_name,
            full_name = excluded.full_name,
            program = excluded.program,
            year_level = excluded.year_level,
            campus = excluded.campus,
            match_first = excluded.match_first,
            match_last = excluded.match_last`,
    args: [
      record.studentNo,
      record.firstName,
      record.middleInitial,
      record.lastName,
      record.fullName,
      record.program,
      record.yearLevel,
      record.campus,
      record.matchFirst,
      record.matchLast,
    ],
  }));

  for (let i = 0; i < statements.length; i += 200) {
    await db.batch(statements.slice(i, i + 200), "write");
  }

  const counts = await db.execute(
    "SELECT campus, COUNT(*) AS n FROM students GROUP BY campus ORDER BY campus",
  );
  const total = await db.execute("SELECT COUNT(*) AS n FROM students");

  console.log(`Imported ${all.length} unique first-year students.`);
  console.log(`  rows scanned:      ${totalRows}`);
  console.log(`  first-year rows:   ${firstYearRows}`);
  console.log(`  unique students:   ${all.length}`);
  for (const row of counts.rows) {
    console.log(`  ${String(row.campus).padEnd(6)}: ${Number(row.n)}`);
  }
  console.log(`  database total:    ${Number(total.rows[0]?.n ?? 0)}`);

  if (conflicts.length > 0) {
    console.log(`\nID conflicts (${conflicts.length}):`);
    for (const conflict of conflicts) console.log(`  - ${conflict}`);
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped rows (${skipped.length}):`);
    for (const item of skipped) console.log(`  - ${item}`);
  }

  if (all.length !== 2534) {
    console.warn(
      `\nWarning: expected 2,534 students but imported ${all.length}. Check the roster.`,
    );
  }
}

main().catch((error) => {
  console.error("Roster import failed:", error);
  process.exit(1);
});
