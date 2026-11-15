/**
 * Date helpers.
 *
 * All calendar logic runs in Asia/Manila so "today" is correct for the
 * office even when the server is hosted in another timezone. Dates are
 * passed around as `YYYY-MM-DD` strings.
 */

export const MANILA_TZ = "Asia/Manila";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MANILA_TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TZ,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Today's date in Manila as `YYYY-MM-DD`. */
export function todayISO(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** Current hour (0-23) in Manila. */
export function manilaHour(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

/** Parse `YYYY-MM-DD` as UTC midnight so day arithmetic is timezone-safe. */
export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return parseISO(iso).getUTCDay();
}

/** The SDSD office accepts students Monday through Thursday. */
export function isOfficeDay(iso: string): boolean {
  const day = dayOfWeek(iso);
  return day >= 1 && day <= 4;
}

/**
 * First office day at or after `iso` (or after it when `includeToday` is
 * false). Falls back to `iso` if no office day is found, which cannot happen
 * for a normal calendar but keeps the return type simple.
 */
export function nextOfficeDay(iso: string, includeToday = true): string {
  let cursor = includeToday ? iso : addDays(iso, 1);
  for (let i = 0; i < 14; i += 1) {
    if (isOfficeDay(cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/** Up to `count` office days starting at `startISO` (inclusive). */
export function officeDaysFrom(startISO: string, count: number): string[] {
  const days: string[] = [];
  let cursor = startISO;
  let guard = 0;
  while (days.length < count && guard < count * 7 + 14) {
    if (isOfficeDay(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
}

export function formatLongDate(iso: string): string {
  return longDateFormatter.format(parseISO(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(parseISO(iso));
}

export function formatWeekday(iso: string): string {
  return weekdayFormatter.format(parseISO(iso));
}

/** Queue numbers are whole-day and zero-padded for display only. */
export function formatQueue(queue: number): string {
  return String(queue).padStart(3, "0");
}

/** Formats a SQLite UTC timestamp (`YYYY-MM-DD HH:MM:SS`) in Manila time. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return timestampFormatter.format(date);
}

export function isPastDate(iso: string): boolean {
  return iso < todayISO();
}
