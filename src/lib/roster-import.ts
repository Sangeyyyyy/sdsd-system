import ExcelJS from "exceljs";
import type { Client, Transaction } from "@libsql/client";
import { ensureDb } from "./db";
import { getSettings } from "./settings";
import {
  buildFullName,
  normalizeFirstName,
  normalizeLastName,
  normalizeStudentNo,
  titleCase,
} from "./names";
import { normalizeSchoolYear, schoolYearStart } from "./school-year";

/**
 * Roster workbook parsing and import.
 *
 * The template is deliberately simple: one `ROSTER` sheet, headers in row 1,
 * data from row 2. Headers are matched by name so the column order can move,
 * and extra columns or sheets are ignored. The same column definitions drive
 * both the parser and the downloadable template so they cannot drift.
 */

export const ROSTER_SHEET_NAME = "ROSTER";

export type RosterColumnKey =
  | "studentNo"
  | "firstName"
  | "middleInitial"
  | "lastName"
  | "program"
  | "yearLevel"
  | "campus"
  | "schoolYear";

export type RosterColumn = {
  key: RosterColumnKey;
  header: string;
  required: boolean;
  width: number;
  example: string;
};

export const ROSTER_COLUMNS: RosterColumn[] = [
  {
    key: "studentNo",
    header: "Student ID",
    required: true,
    width: 16,
    example: "2027-00001",
  },
  {
    key: "firstName",
    header: "First Name",
    required: true,
    width: 22,
    example: "Juan",
  },
  {
    key: "middleInitial",
    header: "Middle Initial",
    required: false,
    width: 14,
    example: "D",
  },
  {
    key: "lastName",
    header: "Last Name",
    required: true,
    width: 22,
    example: "Dela Cruz",
  },
  {
    key: "program",
    header: "Program",
    required: true,
    width: 18,
    example: "BSIT",
  },
  {
    key: "yearLevel",
    header: "Year Level",
    required: false,
    width: 12,
    example: "1",
  },
  {
    key: "campus",
    header: "Campus",
    required: true,
    width: 12,
    example: "MAIN",
  },
  {
    key: "schoolYear",
    header: "School Year",
    required: false,
    width: 16,
    example: "2027-2028",
  },
];

const HEADER_ALIASES: Record<RosterColumnKey, string[]> = {
  studentNo: ["STUDENT ID", "STUDENT NO", "STUDENT NUMBER", "ID"],
  firstName: ["FIRST NAME", "FIRSTNAME", "GIVEN NAME"],
  middleInitial: [
    "MIDDLE INITIAL",
    "MIDDLE INITIALS",
    "MIDDLE NAME INITIAL",
    "MI",
    "M I",
  ],
  lastName: ["LAST NAME", "LASTNAME", "SURNAME", "FAMILY NAME"],
  program: ["PROGRAM", "PROGRAM CODE", "COURSE", "DEGREE"],
  yearLevel: ["YEAR LEVEL", "YEARLEVEL", "YEAR", "LEVEL"],
  campus: ["CAMPUS", "SITE"],
  schoolYear: ["SCHOOL YEAR", "ACADEMIC YEAR", "SY"],
};

export type RosterRow = {
  rowNumber: number;
  studentNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  fullName: string;
  program: string;
  yearLevel: number;
  campus: "MAIN" | "SAMAL";
  schoolYear: string;
  matchFirst: string;
  matchLast: string;
};

export type RosterRowError = { row: number; message: string };

export type RosterParseResult = {
  schoolYear: string;
  rows: RosterRow[];
  errors: RosterRowError[];
  /** Rows that were completely empty and ignored. */
  blankRows: number;
  /** Non-empty data rows scanned, including invalid ones. */
  totalRows: number;
  /** True when the workbook can be imported. */
  ok: boolean;
};

function normalizeHeader(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** ExcelJS supports data validations at runtime but omits them from its types. */
type SheetWithValidations = ExcelJS.Worksheet & {
  dataValidations: {
    add(range: string, validation: Record<string, unknown>): void;
  };
};

function cellText(cell: ExcelJS.Cell): string {
  return (cell.text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeProgram(value: string): string {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

function parseYearLevel(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : null;
}

function findHeaderColumns(
  sheet: ExcelJS.Worksheet,
): { columns: Map<RosterColumnKey, number>; errors: RosterRowError[] } {
  const columns = new Map<RosterColumnKey, number>();
  const headerRow = sheet.getRow(1);

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const header = normalizeHeader(cellText(cell));
    if (!header) return;
    for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
      [RosterColumnKey, string[]]
    >) {
      if (aliases.includes(header) && !columns.has(key)) {
        columns.set(key, columnNumber);
      }
    }
  });

  const errors: RosterRowError[] = [];
  for (const column of ROSTER_COLUMNS) {
    if (column.required && !columns.has(column.key)) {
      errors.push({
        row: 1,
        message: `Missing required column "${column.header}".`,
      });
    }
  }
  return { columns, errors };
}

/**
 * Parses a roster workbook. Nothing is written to the database, so callers
 * can show a preview first and only apply a clean file.
 */
export async function parseRosterBuffer(
  buffer: Buffer | ArrayBuffer,
  schoolYearInput: string,
): Promise<RosterParseResult> {
  const schoolYear = normalizeSchoolYear(schoolYearInput);
  const empty: RosterParseResult = {
    schoolYear: schoolYear ?? "",
    rows: [],
    errors: [],
    blankRows: 0,
    totalRows: 0,
    ok: false,
  };

  if (!schoolYear) {
    empty.errors.push({
      row: 0,
      message: `School year "${schoolYearInput}" must look like 2027-2028.`,
    });
    return empty;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const sheet =
    workbook.getWorksheet(ROSTER_SHEET_NAME) ??
    workbook.worksheets.find(
      (candidate) =>
        candidate.name.trim().toUpperCase() === ROSTER_SHEET_NAME,
    );

  if (!sheet) {
    empty.errors.push({
      row: 0,
      message: `Workbook must contain a sheet named ${ROSTER_SHEET_NAME}.`,
    });
    return empty;
  }

  const { columns, errors } = findHeaderColumns(sheet);
  if (errors.length > 0) {
    return { ...empty, errors };
  }

  const rows: RosterRow[] = [];
  const seen = new Map<string, number>();
  let blankRows = 0;
  let totalRows = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw: Record<RosterColumnKey, string> = {
      studentNo: "",
      firstName: "",
      middleInitial: "",
      lastName: "",
      program: "",
      yearLevel: "",
      campus: "",
      schoolYear: "",
    };
    for (const [key, columnNumber] of columns) {
      raw[key] = cellText(row.getCell(columnNumber));
    }

    const hasAnyValue = Object.values(raw).some(Boolean);
    if (!hasAnyValue) {
      blankRows += 1;
      return;
    }
    totalRows += 1;

    const rowErrors: string[] = [];
    const studentNo = normalizeStudentNo(raw.studentNo);
    const firstName = titleCase(raw.firstName);
    const lastName = titleCase(raw.lastName);
    const middleInitial = raw.middleInitial.toUpperCase();
    const program = normalizeProgram(raw.program);

    if (!/^\d{4}-\d{5}$/.test(studentNo)) {
      rowErrors.push(
        `Student ID "${raw.studentNo || "(blank)"}" must look like ${schoolYearStart(schoolYear)}-00001.`,
      );
    } else if (!studentNo.startsWith(`${schoolYearStart(schoolYear)}-`)) {
      rowErrors.push(
        `Student ID ${studentNo} does not match school year ${schoolYear}.`,
      );
    } else if (seen.has(studentNo)) {
      rowErrors.push(
        `Duplicate Student ID ${studentNo} (also on row ${seen.get(studentNo)}).`,
      );
    } else {
      seen.set(studentNo, rowNumber);
    }

    if (!firstName) {
      rowErrors.push("First Name is required.");
    } else if (firstName.length > 80) {
      rowErrors.push("First Name must be 80 characters or fewer.");
    }

    if (!lastName) {
      rowErrors.push("Last Name is required.");
    } else if (lastName.length > 80) {
      rowErrors.push("Last Name must be 80 characters or fewer.");
    }

    if (middleInitial.length > 5) {
      rowErrors.push("Middle Initial must be 5 characters or fewer.");
    }

    if (!program) {
      rowErrors.push("Program is required.");
    } else if (program.length > 40) {
      rowErrors.push("Program must be 40 characters or fewer.");
    }

    let yearLevel = 1;
    if (raw.yearLevel) {
      const parsed = parseYearLevel(raw.yearLevel);
      if (parsed !== 1) {
        rowErrors.push("Year Level must be 1 for an incoming roster.");
      } else {
        yearLevel = parsed;
      }
    }

    const campusValue = raw.campus.toUpperCase();
    if (campusValue !== "MAIN" && campusValue !== "SAMAL") {
      rowErrors.push('Campus must be "MAIN" or "SAMAL".');
    }

    if (raw.schoolYear) {
      const fileYear = normalizeSchoolYear(raw.schoolYear);
      if (!fileYear) {
        rowErrors.push(
          `School Year "${raw.schoolYear}" must look like ${schoolYear}.`,
        );
      } else if (fileYear !== schoolYear) {
        rowErrors.push(
          `School Year ${fileYear} does not match the upload year ${schoolYear}.`,
        );
      }
    }

    if (rowErrors.length > 0) {
      for (const message of rowErrors) {
        errors.push({ row: rowNumber, message });
      }
      return;
    }

    rows.push({
      rowNumber,
      studentNo,
      firstName,
      middleInitial,
      lastName,
      fullName: buildFullName(firstName, middleInitial, lastName),
      program,
      yearLevel,
      campus: campusValue as "MAIN" | "SAMAL",
      schoolYear,
      matchFirst: normalizeFirstName(firstName),
      matchLast: normalizeLastName(lastName),
    });
  });

  return {
    schoolYear,
    rows,
    errors,
    blankRows,
    totalRows,
    ok: errors.length === 0 && rows.length > 0,
  };
}

/** Builds the downloadable `.xlsx` template for a school year. */
export async function buildRosterTemplate(
  schoolYearInput: string,
): Promise<Buffer> {
  const schoolYear = normalizeSchoolYear(schoolYearInput) ?? schoolYearInput;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SDSD Q";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(ROSTER_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = ROSTER_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  sheet.getColumn(1).numFmt = "@";

  const validations = (sheet as SheetWithValidations).dataValidations;
  validations.add("F2:F5000", {
    type: "list",
    allowBlank: true,
    formulae: ['"1"'],
    showErrorMessage: true,
    errorTitle: "Year Level",
    error: "Incoming rosters must use Year Level 1.",
  });
  validations.add("G2:G5000", {
    type: "list",
    allowBlank: true,
    formulae: ['"MAIN,SAMAL"'],
    showErrorMessage: true,
    errorTitle: "Campus",
    error: "Campus must be MAIN or SAMAL.",
  });

  const readme = workbook.addWorksheet("README");
  readme.columns = [{ width: 24 }, { width: 80 }];
  const lines: Array<[string, string]> = [
    ["Template", `SDSD Q roster for school year ${schoolYear}`],
    ["Sheet", `Enter students on the ${ROSTER_SHEET_NAME} sheet only.`],
    ["Row 1", "Headers. Do not rename or reorder them."],
    ["Row 2", "First student. One student per row, no blank rows in between."],
    [
      "Student ID",
      `Required. Format ${schoolYearStart(schoolYear)}-00001. The first four digits must match ${schoolYear}.`,
    ],
    ["First Name", "Required. Up to 80 characters."],
    ["Middle Initial", "Optional. Up to 5 characters."],
    ["Last Name", "Required. Up to 80 characters."],
    ["Program", "Required. Program code, up to 40 characters (for example BSIT)."],
    ["Year Level", "Optional. If filled in, it must be 1."],
    ["Campus", "Required. MAIN or SAMAL."],
    [
      "School Year",
      `Optional. If filled in, it must be ${schoolYear}.`,
    ],
    ["Blank rows", "Ignored."],
    ["Extra columns", "Ignored."],
    ["Extra sheets", "Ignored, including this README."],
  ];
  lines.forEach(([label, value], index) => {
    const row = readme.getRow(index + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });
  readme.getRow(1).height = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

export type RosterPreview = {
  schoolYear: string;
  totalRows: number;
  validRows: number;
  blankRows: number;
  newStudents: number;
  updatedStudents: number;
  outgoingStudents: number;
  outgoingWithHistory: number;
  outgoingWithoutHistory: number;
  outstandingBookings: number;
  warnings: string[];
  errors: RosterRowError[];
  canApply: boolean;
};

async function countActiveOutgoing(
  db: Client,
  activeSchoolYear: string,
  incoming: Set<string>,
): Promise<{
  outgoing: number;
  withHistory: number;
  withoutHistory: number;
  outstandingBookings: number;
}> {
  const result = await db.execute({
    sql: `SELECT s.id, s.student_no,
            EXISTS (SELECT 1 FROM appointments a WHERE a.student_id = s.id) AS has_history,
            (SELECT COUNT(*) FROM appointments a WHERE a.student_id = s.id AND a.status = 'booked') AS booked
          FROM students s
          WHERE s.school_year = ? AND s.is_active = 1`,
    args: [activeSchoolYear],
  });

  let outgoing = 0;
  let withHistory = 0;
  let withoutHistory = 0;
  let outstandingBookings = 0;

  for (const row of result.rows) {
    if (incoming.has(String(row.student_no))) continue;
    outgoing += 1;
    const booked = Number(row.booked ?? 0);
    outstandingBookings += booked;
    if (Number(row.has_history ?? 0) > 0 || booked > 0) {
      withHistory += 1;
    } else {
      withoutHistory += 1;
    }
  }

  return { outgoing, withHistory, withoutHistory, outstandingBookings };
}

/**
 * Compares a parsed workbook with the current roster without writing
 * anything. The import is blocked while any row error exists.
 */
export async function previewRosterImport(
  parsed: RosterParseResult,
): Promise<RosterPreview> {
  const db = await ensureDb();
  const settings = await getSettings();
  const incoming = new Set(parsed.rows.map((row) => row.studentNo));

  const [existing, active] = await Promise.all([
    db.execute("SELECT student_no FROM students"),
    countActiveOutgoing(db, settings.activeSchoolYear, incoming),
  ]);

  const existingIds = new Set(
    existing.rows.map((row) => String(row.student_no)),
  );
  const updatedStudents = parsed.rows.filter((row) =>
    existingIds.has(row.studentNo),
  ).length;
  const newStudents = parsed.rows.length - updatedStudents;

  const activeCount = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM students WHERE school_year = ? AND is_active = 1",
    args: [settings.activeSchoolYear],
  });
  const activeTotal = Number(activeCount.rows[0]?.n ?? 0);

  const warnings: string[] = [];
  if (parsed.rows.length === 0) {
    warnings.push("The file has no usable student rows.");
  } else if (activeTotal > 0 && parsed.rows.length < activeTotal / 2) {
    warnings.push(
      `The file has ${parsed.rows.length.toLocaleString()} students, far fewer than the ${activeTotal.toLocaleString()} on the active roster. Check that the whole roster was exported.`,
    );
  }
  if (active.outstandingBookings > 0) {
    warnings.push(
      `${active.outstandingBookings.toLocaleString()} outstanding booking${
        active.outstandingBookings === 1 ? "" : "s"
      } will be cancelled for students who are not in the new roster.`,
    );
  }

  return {
    schoolYear: parsed.schoolYear,
    totalRows: parsed.totalRows,
    validRows: parsed.rows.length,
    blankRows: parsed.blankRows,
    newStudents,
    updatedStudents,
    outgoingStudents: active.outgoing,
    outgoingWithHistory: active.withHistory,
    outgoingWithoutHistory: active.withoutHistory,
    outstandingBookings: active.outstandingBookings,
    warnings,
    errors: parsed.errors,
    canApply: parsed.ok,
  };
}

export type RosterImportMode = "replace" | "merge";

export type RosterImportOptions = {
  schoolYear: string;
  filename: string;
  actor: { id: number; displayName: string };
  mode?: RosterImportMode;
};

export type RosterImportSummary = {
  schoolYear: string;
  totalRows: number;
  imported: number;
  archived: number;
  deleted: number;
  cancelledBookings: number;
  skipped: number;
};

async function releaseSlot(
  tx: Transaction,
  date: string,
): Promise<void> {
  await tx.execute({
    sql: "UPDATE day_capacity SET booked = CASE WHEN booked > 0 THEN booked - 1 ELSE 0 END WHERE date = ?",
    args: [date],
  });
}

/**
 * Writes a parsed roster. In `replace` mode the currently active cohort is
 * retired: outstanding bookings are cancelled, students without history are
 * deleted, and students with history are kept as archived records.
 */
export async function applyRosterImport(
  parsed: RosterParseResult,
  options: RosterImportOptions,
): Promise<RosterImportSummary> {
  if (!parsed.ok) {
    throw new Error("Cannot import a roster that has validation errors.");
  }

  const db = await ensureDb();
  const settings = await getSettings();
  const mode = options.mode ?? "replace";
  const tx = await db.transaction("write");

  let archived = 0;
  let deleted = 0;
  let cancelledBookings = 0;

  try {
    if (mode === "replace") {
      const incoming = new Set(parsed.rows.map((row) => row.studentNo));
      const outgoing = await tx.execute({
        sql: `SELECT s.id, s.student_no,
                EXISTS (SELECT 1 FROM appointments a WHERE a.student_id = s.id) AS has_history
              FROM students s
              WHERE s.school_year = ? AND s.is_active = 1`,
        args: [settings.activeSchoolYear],
      });

      for (const row of outgoing.rows) {
        const studentNo = String(row.student_no);
        if (incoming.has(studentNo)) continue;

        const studentId = Number(row.id);
        const booked = await tx.execute({
          sql: "SELECT id, appointment_date FROM appointments WHERE student_id = ? AND status = 'booked'",
          args: [studentId],
        });

        for (const appointment of booked.rows) {
          const appointmentId = Number(appointment.id);
          const date = String(appointment.appointment_date);
          await tx.execute({
            sql: "UPDATE appointments SET status = 'cancelled' WHERE id = ?",
            args: [appointmentId],
          });
          await releaseSlot(tx, date);
          await tx.execute({
            sql: "INSERT INTO audit_log (admin_id, action, appointment_id, details) VALUES (?, ?, ?, ?)",
            args: [
              options.actor.id,
              "status:cancelled",
              appointmentId,
              `Cancelled during ${options.schoolYear} roster import`,
            ],
          });
          cancelledBookings += 1;
        }

        const hasHistory =
          Number(row.has_history ?? 0) > 0 || booked.rows.length > 0;
        if (hasHistory) {
          await tx.execute({
            sql: "UPDATE students SET is_active = 0 WHERE id = ?",
            args: [studentId],
          });
          archived += 1;
        } else {
          await tx.execute({
            sql: "DELETE FROM students WHERE id = ?",
            args: [studentId],
          });
          deleted += 1;
        }
      }
    }

    const statements = parsed.rows.map((row) => ({
      sql: `INSERT INTO students
              (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, school_year, is_active, match_first, match_last)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(student_no) DO UPDATE SET
              first_name = excluded.first_name,
              middle_initial = excluded.middle_initial,
              last_name = excluded.last_name,
              full_name = excluded.full_name,
              program = excluded.program,
              year_level = excluded.year_level,
              campus = excluded.campus,
              school_year = excluded.school_year,
              is_active = 1,
              match_first = excluded.match_first,
              match_last = excluded.match_last`,
      args: [
        row.studentNo,
        row.firstName,
        row.middleInitial,
        row.lastName,
        row.fullName,
        row.program,
        row.yearLevel,
        row.campus,
        row.schoolYear,
        row.matchFirst,
        row.matchLast,
      ],
    }));

    for (let i = 0; i < statements.length; i += 200) {
      await tx.batch(statements.slice(i, i + 200));
    }

    await tx.execute({
      sql: "INSERT INTO settings (key, value) VALUES ('active_school_year', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: [options.schoolYear],
    });

    const summary: RosterImportSummary = {
      schoolYear: options.schoolYear,
      totalRows: parsed.totalRows,
      imported: parsed.rows.length,
      archived,
      deleted,
      cancelledBookings,
      skipped: parsed.blankRows,
    };

    await tx.execute({
      sql: "INSERT INTO audit_log (admin_id, action, appointment_id, details) VALUES (?, 'roster.imported', NULL, ?)",
      args: [
        options.actor.id,
        `${options.filename} → ${options.schoolYear}: ${summary.imported} students, ${summary.deleted} deleted, ${summary.archived} archived, ${summary.cancelledBookings} bookings cancelled`,
      ],
    });

    await tx.execute({
      sql: `INSERT INTO roster_imports
              (school_year, filename, admin_id, total_rows, imported, archived, deleted, cancelled_bookings, skipped)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        options.schoolYear,
        options.filename,
        options.actor.id,
        summary.totalRows,
        summary.imported,
        summary.archived,
        summary.deleted,
        summary.cancelledBookings,
        summary.skipped,
      ],
    });

    await tx.commit();
    return summary;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export type RosterImportHistoryItem = {
  id: number;
  schoolYear: string;
  filename: string;
  adminName: string | null;
  totalRows: number;
  imported: number;
  archived: number;
  deleted: number;
  cancelledBookings: number;
  skipped: number;
  createdAt: string;
};

export async function listRosterImports(
  limit = 20,
): Promise<RosterImportHistoryItem[]> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT r.*, a.display_name AS admin_name
          FROM roster_imports r
          LEFT JOIN admins a ON a.id = r.admin_id
          ORDER BY r.id DESC
          LIMIT ?`,
    args: [Math.max(1, Math.min(100, limit))],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    schoolYear: String(row.school_year),
    filename: String(row.filename),
    adminName: row.admin_name ? String(row.admin_name) : null,
    totalRows: Number(row.total_rows ?? 0),
    imported: Number(row.imported ?? 0),
    archived: Number(row.archived ?? 0),
    deleted: Number(row.deleted ?? 0),
    cancelledBookings: Number(row.cancelled_bookings ?? 0),
    skipped: Number(row.skipped ?? 0),
    createdAt: String(row.created_at ?? ""),
  }));
}
