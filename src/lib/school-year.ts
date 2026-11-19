/**
 * School year helpers.
 *
 * A school year is stored as `YYYY-YYYY` (for example `2026-2027`). Student
 * numbers carry the start year as their prefix (`2026-00001`), so a roster
 * import can be checked against the year it is being imported for.
 */

export const DEFAULT_SCHOOL_YEAR = "2026-2027";

export function normalizeSchoolYear(value: unknown): string | null {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;

  return `${start}-${end}`;
}

export function schoolYearStart(value: string): string {
  return value.slice(0, 4);
}

/** True when a student number belongs to the given school year. */
export function studentNoMatchesYear(
  studentNo: string,
  schoolYear: string,
): boolean {
  return studentNo.startsWith(`${schoolYearStart(schoolYear)}-`);
}
