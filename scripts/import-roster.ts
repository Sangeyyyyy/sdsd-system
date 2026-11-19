import "./env";
import fs from "node:fs";
import path from "node:path";
import { ensureDb } from "../src/lib/db";
import { ensureDefaultSettings, getSettings } from "../src/lib/settings";
import { normalizeSchoolYear } from "../src/lib/school-year";
import {
  applyRosterImport,
  parseRosterBuffer,
  previewRosterImport,
  type RosterImportMode,
} from "../src/lib/roster-import";

/**
 * Roster import CLI.
 *
 *   npm run db:import -- --file excel/roster-2027.xlsx --year 2027-2028
 *   npm run db:import -- --file roster.xlsx --year 2027-2028 --dry-run
 *   npm run db:import -- --file roster.xlsx --year 2027-2028 --mode merge
 *
 * The default mode replaces the active cohort: outstanding bookings are
 * cancelled, students without history are deleted, and students with history
 * are archived. Use the in-app import for a preview UI.
 */

const DEFAULT_FILE = "excel/roster.xlsx";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function printErrors(
  errors: Array<{ row: number; message: string }>,
  limit = 40,
): void {
  console.error(`\n${errors.length} problem${errors.length === 1 ? "" : "s"} found:`);
  for (const error of errors.slice(0, limit)) {
    console.error(`  row ${error.row}: ${error.message}`);
  }
  if (errors.length > limit) {
    console.error(`  … and ${errors.length - limit} more.`);
  }
}

async function main() {
  const file = path.resolve(argument("--file") ?? DEFAULT_FILE);
  const modeArg = (argument("--mode") ?? "replace").toLowerCase();
  if (modeArg !== "replace" && modeArg !== "merge") {
    console.error('--mode must be "replace" or "merge".');
    process.exit(1);
  }
  const mode = modeArg as RosterImportMode;
  const dryRun = hasFlag("--dry-run");

  await ensureDb();
  await ensureDefaultSettings();
  const settings = await getSettings();

  const yearArg = argument("--year") ?? settings.activeSchoolYear;
  const schoolYear = normalizeSchoolYear(yearArg);
  if (!schoolYear) {
    console.error(`--year "${yearArg}" must look like 2027-2028.`);
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error(`Roster file not found: ${file}`);
    console.error(
      "Pass --file <path> or place the workbook at excel/roster.xlsx.",
    );
    process.exit(1);
  }

  const buffer = fs.readFileSync(file);
  const parsed = await parseRosterBuffer(buffer, schoolYear);

  console.log(`Workbook:    ${path.basename(file)}`);
  console.log(`School year: ${schoolYear}`);
  console.log(`Mode:        ${mode}${dryRun ? " (dry run)" : ""}`);
  console.log(`Rows:        ${parsed.totalRows} scanned, ${parsed.rows.length} valid, ${parsed.blankRows} blank`);

  if (!parsed.ok) {
    printErrors(parsed.errors);
    process.exit(1);
  }

  const preview = await previewRosterImport(parsed);
  console.log(`New students:      ${preview.newStudents}`);
  console.log(`Updated students:  ${preview.updatedStudents}`);
  if (mode === "replace") {
    console.log(`Outgoing cohort:   ${preview.outgoingStudents}`);
    console.log(`  keep (history):  ${preview.outgoingWithHistory}`);
    console.log(`  delete (empty):  ${preview.outgoingWithoutHistory}`);
    console.log(`  bookings to cancel: ${preview.outstandingBookings}`);
  }
  for (const warning of preview.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (dryRun) {
    console.log("\nDry run: nothing was written.");
    return;
  }

  const summary = await applyRosterImport(parsed, {
    schoolYear,
    filename: path.basename(file),
    actor: { id: 0, displayName: "CLI import" },
    mode,
  });

  console.log("\nImport complete.");
  console.log(`  imported:            ${summary.imported}`);
  console.log(`  archived:            ${summary.archived}`);
  console.log(`  deleted:             ${summary.deleted}`);
  console.log(`  cancelled bookings:  ${summary.cancelledBookings}`);
  console.log(`  active school year:  ${summary.schoolYear}`);
}

main().catch((error) => {
  console.error("Roster import failed:", error);
  process.exit(1);
});
