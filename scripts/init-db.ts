import "./env";
import { ensureDb } from "../src/lib/db";
import {
  ensureDefaultSettings,
  ensureHorizon,
  getSettings,
} from "../src/lib/settings";

async function main() {
  const db = await ensureDb();
  await ensureDefaultSettings();
  await ensureHorizon(120);
  const settings = await getSettings();

  const students = await db.execute("SELECT COUNT(*) AS n FROM students");
  const capacity = await db.execute("SELECT COUNT(*) AS n FROM day_capacity");
  const admins = await db.execute("SELECT COUNT(*) AS n FROM admins");

  console.log("Database ready.");
  console.log(`  students:    ${Number(students.rows[0]?.n ?? 0)}`);
  console.log(`  admins:      ${Number(admins.rows[0]?.n ?? 0)}`);
  console.log(`  capacity:    ${Number(capacity.rows[0]?.n ?? 0)} office days`);
  console.log(`  daily limit: ${settings.dailyLimit}`);
  console.log(`  SAMAL:       ${settings.samalEnabled ? "enabled" : "disabled"}`);
}

main().catch((error) => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});
