import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

/**
 * Production schema-upgrade test against a throwaway SQLite database.
 *
 * Simulates an older database (no school-year columns, no roster_imports) and
 * verifies that the first production request upgrades it in place, keeps
 * existing rows, and records the schema version.
 *
 * Run with: npm run test:migrate
 */

const dbPath = path.join(process.cwd(), "data", "test-migrate.db");
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  try {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  } catch {
    // Ignore.
  }
}

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";

// Build a database that predates the school-year release.
const legacy = createClient({ url: process.env.DATABASE_URL });
await legacy.executeMultiple(`
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_no TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_initial TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  program TEXT NOT NULL,
  year_level INTEGER NOT NULL DEFAULT 1,
  campus TEXT NOT NULL DEFAULT 'MAIN',
  match_first TEXT NOT NULL,
  match_last TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
await legacy.execute({
  sql: `INSERT INTO students
          (student_no, first_name, middle_initial, last_name, full_name, program, year_level, campus, match_first, match_last)
        VALUES ('2026-00001', 'Maria', 'S', 'Santos', 'Maria S Santos', 'BSIT', 1, 'MAIN', 'MARIA', 'SANTOS')`,
});
await legacy.close();

// A production server must upgrade the database on its first request.
(process.env as Record<string, string | undefined>).NODE_ENV = "production";
delete process.env.FORCE_DB_INIT;

const { ensureDb, SCHEMA_VERSION } = await import("../src/lib/db");
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

const studentColumns = await db.execute("PRAGMA table_info(students)");
const studentNames = new Set(studentColumns.rows.map((row) => String(row.name)));
check("students gains school_year", studentNames.has("school_year"));
check("students gains is_active", studentNames.has("is_active"));

const adminColumns = await db.execute("PRAGMA table_info(admins)");
const adminNames = new Set(adminColumns.rows.map((row) => String(row.name)));
check("admins gains role", adminNames.has("role"));
check("admins gains is_active", adminNames.has("is_active"));

const tables = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table'",
);
const tableNames = new Set(tables.rows.map((row) => String(row.name)));
check("roster_imports is created", tableNames.has("roster_imports"));
check("appointments is created", tableNames.has("appointments"));
check("settings is kept", tableNames.has("settings"));

const existing = await db.execute({
  sql: "SELECT school_year, is_active FROM students WHERE student_no = ?",
  args: ["2026-00001"],
});
check("existing student is kept", existing.rows.length === 1);
check(
  "existing student gets the default year",
  String(existing.rows[0]?.school_year) === "2026-2027",
  String(existing.rows[0]?.school_year),
);
check(
  "existing student stays active",
  Number(existing.rows[0]?.is_active) === 1,
);

const version = await db.execute("PRAGMA user_version");
check(
  "schema version is recorded",
  Number(version.rows[0]?.user_version) === SCHEMA_VERSION,
  `${version.rows[0]?.user_version} vs ${SCHEMA_VERSION}`,
);

let secondCall = true;
try {
  await ensureDb();
} catch {
  secondCall = false;
}
check("a second request is safe", secondCall);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
