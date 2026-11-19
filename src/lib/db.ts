import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { SCHEMA_SQL } from "./schema";

/**
 * A single libSQL client is reused across hot reloads and server requests.
 * Local dev uses `file:data/app.db`; production can point at Turso via env.
 */
const globalForDb = globalThis as unknown as {
  __sdsdDb?: Client;
  __sdsdDbReady?: Promise<void>;
};

function ensureDataDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  const directory = path.dirname(filePath);
  if (!directory || directory === ".") return;
  try {
    mkdirSync(directory, { recursive: true });
  } catch {
    // If the directory cannot be created, libSQL will surface a clear error.
  }
}

export function getDb(): Client {
  if (!globalForDb.__sdsdDb) {
    const url =
      process.env.DATABASE_URL ||
      process.env.TURSO_DATABASE_URL ||
      "file:data/app.db";
    const authToken =
      process.env.DATABASE_AUTH_TOKEN ||
      process.env.TURSO_AUTH_TOKEN ||
      undefined;

    ensureDataDirectory(url);
    globalForDb.__sdsdDb = createClient({
      url,
      authToken,
    });
  }
  return globalForDb.__sdsdDb;
}

/** Ensures the schema exists before the first query. Safe to call repeatedly. */
export async function ensureDb(): Promise<Client> {
  const db = getDb();
  // In production, tables are already created during `npm run db:init`.
  // Skipping redundant DDL checks saves 3 sequential network round-trips on every serverless lambda cold start.
  if (process.env.NODE_ENV === "production" && !process.env.FORCE_DB_INIT) {
    return db;
  }
  if (!globalForDb.__sdsdDbReady) {
    globalForDb.__sdsdDbReady = (async () => {
      await db.executeMultiple(SCHEMA_SQL);
      await migrateAdminAccounts(db);
      await migrateStudents(db);
      await ensureBootstrapSuperAdmin(db);
    })().catch((error) => {
      // Do not cache a failed setup: a later request can retry cleanly.
      globalForDb.__sdsdDbReady = undefined;
      throw error;
    });
  }
  await globalForDb.__sdsdDbReady;
  return db;
}

/**
 * Columns added to `admins` after the first release. `CREATE TABLE IF NOT
 * EXISTS` cannot add columns to an existing table, so we check and alter.
 */
const ADMIN_COLUMNS: Array<[string, string]> = [
  ["role", "TEXT NOT NULL DEFAULT 'staff'"],
  ["is_active", "INTEGER NOT NULL DEFAULT 1"],
  ["must_change_password", "INTEGER NOT NULL DEFAULT 0"],
  ["session_version", "INTEGER NOT NULL DEFAULT 1"],
  ["last_login_at", "TEXT"],
  ["password_changed_at", "TEXT"],
];

async function migrateAdminAccounts(db: Client): Promise<void> {
  const info = await db.execute("PRAGMA table_info(admins)");
  const existing = new Set(info.rows.map((row) => String(row.name)));

  for (const [name, definition] of ADMIN_COLUMNS) {
    if (existing.has(name)) continue;
    await db.execute(`ALTER TABLE admins ADD COLUMN ${name} ${definition}`);
  }
}

/**
 * Columns added to `students` after the first release. Existing rosters are
 * assigned the current school year so they keep working after the upgrade.
 */
const STUDENT_COLUMNS: Array<[string, string]> = [
  ["school_year", "TEXT NOT NULL DEFAULT '2026-2027'"],
  ["is_active", "INTEGER NOT NULL DEFAULT 1"],
];

async function migrateStudents(db: Client): Promise<void> {
  const info = await db.execute("PRAGMA table_info(students)");
  const existing = new Set(info.rows.map((row) => String(row.name)));

  for (const [name, definition] of STUDENT_COLUMNS) {
    if (existing.has(name)) continue;
    await db.execute(`ALTER TABLE students ADD COLUMN ${name} ${definition}`);
  }

  // Created here rather than in SCHEMA_SQL: on an older database the column
  // does not exist until the ALTER above runs.
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_students_year ON students(school_year, campus)",
  );
}

/**
 * Guarantees at least one active super admin so the office can never be
 * locked out of account management. Prefers the env-configured first admin.
 */
async function ensureBootstrapSuperAdmin(db: Client): Promise<void> {
  const supers = await db.execute(
    "SELECT COUNT(*) AS n FROM admins WHERE role = 'super_admin' AND is_active = 1",
  );
  if (Number(supers.rows[0]?.n ?? 0) > 0) return;

  const preferred = process.env.ADMIN1_USERNAME ?? "admin1";
  const byUsername = await db.execute({
    sql: "SELECT id FROM admins WHERE username = ? LIMIT 1",
    args: [preferred],
  });

  const target =
    byUsername.rows[0]?.id ??
    (
      await db.execute(
        "SELECT id FROM admins WHERE is_active = 1 ORDER BY id ASC LIMIT 1",
      )
    ).rows[0]?.id;

  if (target === undefined || target === null) return; // No accounts yet.

  await db.execute({
    sql: "UPDATE admins SET role = 'super_admin' WHERE id = ?",
    args: [target],
  });
}

export const db = getDb();
