import type { Row } from "@libsql/client";
import { ensureDb } from "./db";
import { recordAudit } from "./audit";
import type { StudentRecord } from "./booking";
import {
  buildFullName,
  normalizeFirstName,
  normalizeLastName,
  normalizeStudentNo,
  titleCase,
} from "./names";

/**
 * Manual roster corrections.
 *
 * The roster is normally imported from `excel/roster.xlsx`, but staff need a
 * way to add a missing student or fix a misspelled name without re-running the
 * importer. These helpers keep the normalized match columns in sync so public
 * lookup and booking keep working after an edit.
 */

export type StudentInput = {
  studentNo: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  program: string;
  yearLevel?: number;
  campus: string;
};

export type StudentResult =
  | { ok: true; student: StudentRecord }
  | { ok: false; message: string };

export type StudentActor = { id: number; displayName: string };

function mapStudent(row: Row): StudentRecord {
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

function clean(input: StudentInput): {
  studentNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  fullName: string;
  program: string;
  yearLevel: number;
  campus: "MAIN" | "SAMAL";
} {
  const firstName = titleCase(input.firstName.trim());
  const lastName = titleCase(input.lastName.trim());
  const middleInitial = input.middleInitial?.trim().toUpperCase().slice(0, 5) ?? "";
  const program = input.program.trim().toUpperCase().replace(/\s+/g, " ");
  const campus = input.campus.trim().toUpperCase() === "SAMAL" ? "SAMAL" : "MAIN";

  return {
    studentNo: normalizeStudentNo(input.studentNo),
    firstName,
    middleInitial,
    lastName,
    fullName: buildFullName(firstName, middleInitial, lastName),
    program,
    yearLevel: Number.isFinite(input.yearLevel) ? Number(input.yearLevel) : 1,
    campus,
  };
}

export function validateStudentInput(input: StudentInput): string | null {
  const value = clean(input);

  if (!/^\d{4}-\d{5}$/.test(value.studentNo)) {
    return "Student ID must look like 2026-00001.";
  }
  if (value.firstName.length < 1 || value.firstName.length > 80) {
    return "Enter a first name (up to 80 characters).";
  }
  if (value.lastName.length < 1 || value.lastName.length > 80) {
    return "Enter a last name (up to 80 characters).";
  }
  if (value.middleInitial.length > 5) {
    return "Middle initial must be 5 characters or fewer.";
  }
  if (value.program.length < 1 || value.program.length > 40) {
    return "Enter a program code (up to 40 characters).";
  }
  if (!Number.isInteger(value.yearLevel) || value.yearLevel < 1 || value.yearLevel > 5) {
    return "Year level must be between 1 and 5.";
  }

  return null;
}

export async function getStudentById(
  id: number,
): Promise<StudentRecord | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT * FROM students WHERE id = ? LIMIT 1",
    args: [id],
  });
  const row = result.rows[0];
  return row ? mapStudent(row) : null;
}

export async function createStudent(
  input: StudentInput,
  actor: StudentActor,
): Promise<StudentResult> {
  const error = validateStudentInput(input);
  if (error) return { ok: false, message: error };

  const value = clean(input);
  const db = await ensureDb();

  const duplicate = await db.execute({
    sql: "SELECT id FROM students WHERE student_no = ? LIMIT 1",
    args: [value.studentNo],
  });
  if (duplicate.rows.length > 0) {
    return {
      ok: false,
      message: `Student ID ${value.studentNo} is already on the roster.`,
    };
  }

  const inserted = await db.execute({
    sql: `INSERT INTO students
            (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      value.studentNo,
      value.firstName,
      value.middleInitial,
      value.lastName,
      value.fullName,
      value.program,
      value.yearLevel,
      value.campus,
      normalizeFirstName(value.firstName),
      normalizeLastName(value.lastName),
    ],
  });

  await recordAudit(
    actor,
    "student.created",
    `${value.studentNo} ${value.fullName} (${value.campus})`,
  );

  return { ok: true, student: mapStudent(inserted.rows[0]) };
}

export async function updateStudent(
  id: number,
  input: StudentInput,
  actor: StudentActor,
): Promise<StudentResult> {
  const error = validateStudentInput(input);
  if (error) return { ok: false, message: error };

  const value = clean(input);
  const db = await ensureDb();

  const existing = await db.execute({
    sql: "SELECT * FROM students WHERE id = ? LIMIT 1",
    args: [id],
  });
  const current = existing.rows[0];
  if (!current) {
    return { ok: false, message: "Student not found." };
  }

  if (value.studentNo !== String(current.student_no)) {
    const duplicate = await db.execute({
      sql: "SELECT id FROM students WHERE student_no = ? AND id <> ? LIMIT 1",
      args: [value.studentNo, id],
    });
    if (duplicate.rows.length > 0) {
      return {
        ok: false,
        message: `Student ID ${value.studentNo} is already on the roster.`,
      };
    }
  }

  const updated = await db.execute({
    sql: `UPDATE students SET
            student_no = ?,
            first_name = ?,
            middle_initial = ?,
            last_name = ?,
            full_name = ?,
            program = ?,
            year_level = ?,
            campus = ?,
            match_first = ?,
            match_last = ?
          WHERE id = ?
          RETURNING *`,
    args: [
      value.studentNo,
      value.firstName,
      value.middleInitial,
      value.lastName,
      value.fullName,
      value.program,
      value.yearLevel,
      value.campus,
      normalizeFirstName(value.firstName),
      normalizeLastName(value.lastName),
      id,
    ],
  });

  const changes: string[] = [];
  if (String(current.student_no) !== value.studentNo) changes.push("student ID");
  if (String(current.full_name) !== value.fullName) changes.push("name");
  if (String(current.program) !== value.program) changes.push("program");
  if (String(current.campus) !== value.campus) changes.push("campus");
  if (Number(current.year_level) !== value.yearLevel) changes.push("year level");

  await recordAudit(
    actor,
    "student.updated",
    `${value.studentNo} ${value.fullName}${
      changes.length > 0 ? `: ${changes.join(", ")}` : ": no changes"
    }`,
  );

  return { ok: true, student: mapStudent(updated.rows[0]) };
}
