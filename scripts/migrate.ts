import "./env";

/**
 * Applies schema updates to the configured database.
 *
 *   npm run db:migrate
 *
 * Safe to run repeatedly. Use it after deploying a release that changes the
 * schema, or rely on the app's once-per-process production check. Set
 * DATABASE_URL / DATABASE_AUTH_TOKEN (or TURSO_*) to target production.
 */

process.env.FORCE_DB_INIT = "1";

const { ensureDb, SCHEMA_VERSION } = await import("../src/lib/db");

const db = await ensureDb();
const result = await db.execute("PRAGMA user_version");
const version = Number(result.rows[0]?.user_version ?? 0);

console.log(`Database schema is at version ${version} (latest ${SCHEMA_VERSION}).`);
