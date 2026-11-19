import ExcelJS from "exceljs";

/**
 * Roster workbook parser test. No database is used.
 *
 * Verifies the template shape, header matching, optional columns, and that
 * bad rows are reported instead of silently skipped.
 *
 * Run with: npm run test:roster-import
 */

const {
  ROSTER_COLUMNS,
  ROSTER_SHEET_NAME,
  buildRosterTemplate,
  parseRosterBuffer,
} = await import("../src/lib/roster-import");

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

async function workbook(
  headers: string[],
  rows: Array<Array<string | number | null>>,
  sheetName = ROSTER_SHEET_NAME,
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(sheetName);
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const buffer = await book.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

const fullHeaders = ROSTER_COLUMNS.map((column) => column.header);

// --- Template -------------------------------------------------------------

const template = await buildRosterTemplate("2027-2028");
const templateBook = new ExcelJS.Workbook();
await templateBook.xlsx.load(template as unknown as ArrayBuffer);

check("template has a ROSTER sheet", templateBook.getWorksheet(ROSTER_SHEET_NAME) !== undefined);
check("template has a README sheet", templateBook.getWorksheet("README") !== undefined);

const templateSheet = templateBook.getWorksheet(ROSTER_SHEET_NAME);
const templateHeaders = templateSheet
  ? (templateSheet.getRow(1).values as Array<string | undefined>)
      .slice(1)
      .map((value) => String(value ?? ""))
  : [];
check(
  "template headers match the parser columns",
  JSON.stringify(templateHeaders) === JSON.stringify(fullHeaders),
  templateHeaders.join(" | "),
);
check(
  "template leaves row 2 empty",
  !templateSheet || templateSheet.getRow(2).actualCellCount === 0,
);

const emptyTemplate = await parseRosterBuffer(template, "2027-2028");
check("empty template has no errors", emptyTemplate.errors.length === 0);
check("empty template is not importable", !emptyTemplate.ok);
check("empty template has no rows", emptyTemplate.rows.length === 0);

// --- Clean workbook -------------------------------------------------------

const clean = await workbook(fullHeaders, [
  ["2027-00001", "juan", "d", "dela cruz", "bsit", "1", "MAIN", "2027-2028"],
  ["2027-00002", "Maria", "", "Santos", "bssw", "", "samal", ""],
  ["202700003", "Ana", "s", "reyes", "bsit", "1", "main", ""],
]);

const parsed = await parseRosterBuffer(clean, "2027-2028");
check("clean workbook parses", parsed.ok, parsed.errors.map((e) => e.message).join("; "));
check("all clean rows are kept", parsed.rows.length === 3, String(parsed.rows.length));
check("names are title-cased", parsed.rows[0]?.firstName === "Juan" && parsed.rows[0]?.lastName === "Dela Cruz");
check("full name is built", parsed.rows[0]?.fullName === "Juan D Dela Cruz", parsed.rows[0]?.fullName);
check("program is upper-cased", parsed.rows[0]?.program === "BSIT");
check("campus is upper-cased", parsed.rows[1]?.campus === "SAMAL");
check("year level defaults to 1", parsed.rows[1]?.yearLevel === 1);
check("optional school year is filled in", parsed.rows[1]?.schoolYear === "2027-2028");
check("9-digit ID gets a dash", parsed.rows[2]?.studentNo === "2027-00003", parsed.rows[2]?.studentNo);
check("match columns are normalized", parsed.rows[0]?.matchLast === "DELA CRUZ", parsed.rows[0]?.matchLast);

// --- Invalid rows ---------------------------------------------------------

const broken = await workbook(fullHeaders, [
  ["2026-00001", "Old", "", "Year", "BSIT", "1", "MAIN", ""],
  ["2027-00005", "Dup", "", "One", "BSIT", "1", "MAIN", ""],
  ["2027-00005", "Dup", "", "Two", "BSIT", "1", "MAIN", ""],
  ["2027-00007", "Bad", "", "Campus", "BSIT", "1", "QUEZON", ""],
  ["2027-00008", "Bad", "", "Level", "BSIT", "2", "MAIN", ""],
  ["2027-00009", "", "", "Name", "BSIT", "1", "MAIN", ""],
  ["2027-00010", "Bad", "", "Year", "BSIT", "1", "MAIN", "2026-2027"],
  ["ABC", "Bad", "", "Id", "BSIT", "1", "MAIN", ""],
]);

const brokenParsed = await parseRosterBuffer(broken, "2027-2028");
check("broken workbook is rejected", !brokenParsed.ok);
check("broken workbook keeps only unambiguous rows", brokenParsed.rows.length === 1, String(brokenParsed.rows.length));
check("all broken rows are reported", brokenParsed.errors.length === 7, String(brokenParsed.errors.length));
check(
  "wrong year prefix is reported",
  brokenParsed.errors.some((error) => error.message.includes("does not match school year")),
);
check(
  "duplicate ID is reported",
  brokenParsed.errors.some((error) => error.message.includes("Duplicate Student ID")),
);
check(
  "bad campus is reported",
  brokenParsed.errors.some((error) => error.message.includes("Campus must be")),
);
check(
  "bad year level is reported",
  brokenParsed.errors.some((error) => error.message.includes("Year Level must be 1")),
);
check(
  "missing first name is reported",
  brokenParsed.errors.some((error) => error.message.includes("First Name is required")),
);
check(
  "mismatched school year is reported",
  brokenParsed.errors.some((error) => error.message.includes("does not match the upload year")),
);
check(
  "malformed ID is reported",
  brokenParsed.errors.some((error) => error.message.includes("must look like 2027-00001")),
);

// --- Header aliases and order --------------------------------------------

const aliased = await workbook(
  ["Course", "Last Name", "First Name", "Student No", "Campus"],
  [["BSIT", "Reyes", "Ana", "2027-00011", "MAIN"]],
);
const aliasedParsed = await parseRosterBuffer(aliased, "2027-2028");
check("headers are matched by name", aliasedParsed.ok, aliasedParsed.errors.map((e) => e.message).join("; "));
check("reordered columns work", aliasedParsed.rows[0]?.studentNo === "2027-00011");
check("missing optional columns are allowed", aliasedParsed.rows[0]?.middleInitial === "");

// --- Missing headers / sheet ---------------------------------------------

const missingHeader = await workbook(
  ["Student ID", "First Name", "Program", "Campus"],
  [["2027-00012", "Ana", "BSIT", "MAIN"]],
);
const missingHeaderParsed = await parseRosterBuffer(missingHeader, "2027-2028");
check("missing required header is rejected", !missingHeaderParsed.ok);
check(
  "missing header is named",
  missingHeaderParsed.errors.some((error) => error.message.includes('"Last Name"')),
);

const wrongSheet = await workbook(
  fullHeaders,
  [["2027-00013", "Ana", "", "Reyes", "BSIT", "1", "MAIN", ""]],
  "DATA",
);
const wrongSheetParsed = await parseRosterBuffer(wrongSheet, "2027-2028");
check("missing ROSTER sheet is rejected", !wrongSheetParsed.ok);
check(
  "missing sheet explains the requirement",
  wrongSheetParsed.errors.some((error) => error.message.includes("sheet named ROSTER")),
);

// --- School year argument -------------------------------------------------

const badYear = await parseRosterBuffer(clean, "2027-2029");
check("invalid upload year is rejected", !badYear.ok);
check(
  "invalid upload year is explained",
  badYear.errors.some((error) => error.message.includes("must look like")),
);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
