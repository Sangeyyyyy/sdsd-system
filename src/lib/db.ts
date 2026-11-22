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

/**
 * Bump this whenever `SCHEMA_SQL` or a migration adds something a deploy
 * needs. Production compares it with the version recorded in the
 * `_schema_version` table once per server process, so a release can update an
 * older database without running DDL on every request.
 *
 * Turso Cloud makes `PRAGMA user_version` read-only, so the version lives in a
 * table instead of the SQLite header. Local SQLite databases use the same
 * table, which keeps one code path for both.
 */
export const SCHEMA_VERSION = 1;

const SCHEMA_VERSION_TABLE = "_schema_version";

/** Reads the recorded schema version, treating a missing table as version 0. */
export async function readSchemaVersion(db: Client): Promise<number> {
  const exists = await db.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [SCHEMA_VERSION_TABLE],
  });
  if (exists.rows.length === 0) return 0;

  const result = await db.execute(
    `SELECT version FROM ${SCHEMA_VERSION_TABLE} WHERE id = 1`,
  );
  return Number(result.rows[0]?.version ?? 0);
}

async function writeSchemaVersion(db: Client): Promise<void> {
  await db.executeMultiple(`
CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
  await db.execute({
    sql: `INSERT OR REPLACE INTO ${SCHEMA_VERSION_TABLE} (id, version) VALUES (1, ?)`,
    args: [SCHEMA_VERSION],
  });
}

async function applySchema(db: Client): Promise<void> {
  await db.executeMultiple(SCHEMA_SQL);
  await migrateAdminAccounts(db);
  await migrateStudents(db);
  await ensureBootstrapSuperAdmin(db);
  await writeSchemaVersion(db);
}

/** Ensures the schema exists before the first query. Safe to call repeatedly. */
export async function ensureDb(): Promise<Client> {
  const db = getDb();
  if (!globalForDb.__sdsdDbReady) {
    globalForDb.__sdsdDbReady = (async () => {
      if (process.env.NODE_ENV === "production" && !process.env.FORCE_DB_INIT) {
        const version = await readSchemaVersion(db);
        if (version >= SCHEMA_VERSION) return;
        console.warn(
          `Database schema ${version} is older than ${SCHEMA_VERSION}; applying migrations.`,
        );
      }
      await applySchema(db);
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

/**
 * Adds a column unless it already exists. Two cold starts can race the
 * `PRAGMA table_info` check, so a duplicate-column error counts as done.
 */
async function addColumn(
  db: Client,
  table: string,
  name: string,
  definition: string,
): Promise<void> {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  } catch (error) {
    if (!/duplicate column name/i.test(String(error))) throw error;
  }
}

async function migrateAdminAccounts(db: Client): Promise<void> {
  const info = await db.execute("PRAGMA table_info(admins)");
  const existing = new Set(info.rows.map((row) => String(row.name)));

  for (const [name, definition] of ADMIN_COLUMNS) {
    if (existing.has(name)) continue;
    await addColumn(db, "admins", name, definition);
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
    await addColumn(db, "students", name, definition);
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
