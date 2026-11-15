/** Name normalization used for matching, never for display. */

const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV"]);

export function normalizeToken(value: string | null | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/\u00d1/g, "N")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes generational suffixes so "DELA CRUZ JR." matches "DELA CRUZ". */
export function stripSuffix(value: string): string {
  return value
    .split(" ")
    .filter((token) => !SUFFIXES.has(token))
    .join(" ")
    .trim();
}

export function normalizeFirstName(value: string | null | undefined): string {
  return stripSuffix(normalizeToken(value));
}

export function normalizeLastName(value: string | null | undefined): string {
  return stripSuffix(normalizeToken(value));
}

export function buildFullName(
  first: string,
  middleInitial: string,
  last: string,
): string {
  return [first, middleInitial, last]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Student numbers are stored as `YYYY-NNNNN`. Accept a few common typos
 * (spaces, no dash, lowercase) so students are not blocked by formatting.
 */
export function normalizeStudentNo(value: string | null | undefined): string {
  let raw = (value ?? "").toUpperCase().replace(/\s+/g, "").trim();
  if (/^\d{9}$/.test(raw)) {
    raw = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }
  return raw;
}

/** Turns "DELA CRUZ" into "Dela Cruz" for friendlier display. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_m, prefix: string, letter: string) => {
      return prefix + letter.toUpperCase();
    });
}

export function displayName(fullName: string): string {
  return titleCase(fullName);
}
