import fs from "node:fs";
import path from "node:path";

/**
 * Roster-correction test against a throwaway SQLite database.
 *
 * Verifies that staff can add a missing student and fix an existing record,
 * that the normalized match columns follow name edits, and that bad or
 * duplicate input is rejected without writing an audit entry.
 *
 * Run with: npm run test:students
 */

const dbPath = path.join(process.cwd(), "data", "test-students.db");
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
  createStudent,
  updateStudent,
  getStudentById,
  validateStudentInput,
} = await import("../src/lib/students");
const { lookupStudent } = await import("../src/lib/booking");
const { normalizeFirstName, normalizeLastName } = await import(
  "../src/lib/names"
);

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

async function auditCount(action: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM audit_log WHERE action = ?",
    args: [action],
  });
  return Number(result.rows[0].n);
}

const created = await createStudent(
  {
    studentNo: "2026-10001",
    firstName: "maria",
    middleInitial: "s",
    lastName: "dela cruz",
    program: "bsit",
    yearLevel: 1,
    campus: "main",
  },
  actor,
);

check("student is created", created.ok, created.ok ? "" : created.message);
if (!created.ok) {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}

check("student ID is normalized", created.student.studentNo === "2026-10001");
check("name is title-cased", created.student.fullName === "Maria S Dela Cruz");
check("program is upper-cased", created.student.program === "BSIT");
check("campus is upper-cased", created.student.campus === "MAIN");
check(
  "match columns are normalized",
  created.student.matchFirst === normalizeFirstName("maria") &&
    created.student.matchLast === normalizeLastName("dela cruz"),
  `${created.student.matchFirst} / ${created.student.matchLast}`,
);
check("create is audited", (await auditCount("student.created")) === 1);

const lookup = await lookupStudent("2026-10001", "Dela Cruz");
check("new student can be found by name", lookup !== null);

const duplicate = await createStudent(
  {
    studentNo: "202610001",
    firstName: "Other",
    lastName: "Person",
    program: "BSIT",
    yearLevel: 1,
    campus: "MAIN",
  },
  actor,
);
check("duplicate student ID is rejected", !duplicate.ok);
check(
  "duplicate create is not audited",
  (await auditCount("student.created")) === 1,
);

const invalid = await createStudent(
  {
    studentNo: "ABC",
    firstName: "",
    lastName: "Person",
    program: "BSIT",
    yearLevel: 1,
    campus: "MAIN",
  },
  actor,
);
check("invalid student ID is rejected", !invalid.ok);

check(
  "invalid year level is rejected",
  validateStudentInput({
    studentNo: "2026-10002",
    firstName: "Ana",
    lastName: "Reyes",
    program: "BSIT",
    yearLevel: 9,
    campus: "MAIN",
  }) !== null,
);

const updated = await updateStudent(
  created.student.id,
  {
    studentNo: "2026-10001",
    firstName: "Maria",
    middleInitial: "S",
    lastName: "Santos",
    program: "BSIT",
    yearLevel: 2,
    campus: "SAMAL",
  },
  actor,
);

check("student is updated", updated.ok, updated.ok ? "" : updated.message);
if (updated.ok) {
  check("full name follows the edit", updated.student.fullName === "Maria S Santos");
  check("year level is saved", updated.student.yearLevel === 2);
  check("campus is saved", updated.student.campus === "SAMAL");
  check(
    "match columns follow the edit",
    updated.student.matchLast === normalizeLastName("Santos"),
    updated.student.matchLast,
  );
}

check("update is audited", (await auditCount("student.updated")) === 1);

const byNewName = await lookupStudent("2026-10001", "Santos");
check("edited student is found by the new last name", byNewName !== null);

const byOldName = await lookupStudent("2026-10001", "Dela Cruz");
check("edited student is not found by the old last name", byOldName === null);

const second = await createStudent(
  {
    studentNo: "2026-10002",
    firstName: "Ana",
    lastName: "Reyes",
    program: "BSCS",
    yearLevel: 1,
    campus: "MAIN",
  },
  actor,
);
check("second student is created", second.ok);

if (second.ok) {
  const clash = await updateStudent(
    second.student.id,
    {
      studentNo: "2026-10001",
      firstName: "Ana",
      lastName: "Reyes",
      program: "BSCS",
      yearLevel: 1,
      campus: "MAIN",
    },
    actor,
  );
  check("editing to another student's ID is rejected", !clash.ok);
}

const missing = await updateStudent(
  999999,
  {
    studentNo: "2026-10003",
    firstName: "No",
    lastName: "One",
    program: "BSIT",
    yearLevel: 1,
    campus: "MAIN",
  },
  actor,
);
check("editing an unknown student is rejected", !missing.ok);

const fetched = await getStudentById(created.student.id);
check("student can be loaded by ID", fetched?.studentNo === "2026-10001");

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
