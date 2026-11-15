import type { Client } from "@libsql/client";
import { ensureDb } from "./db";
import { addDays, isOfficeDay, todayISO } from "./dates";

/**
 * Key/value application settings plus day-capacity management.
 *
 * Capacity rows are generated only for office days (Mon-Thu). Booking picks
 * the earliest row that still has room, so the queue fills forward
 * automatically without students choosing dates.
 */

export const DEFAULT_SETTINGS = {
  daily_limit: "200",
  samal_enabled: "false",
  same_day_cutoff_hour: "15",
  max_rebooks: "3",
  booking_open: "true",
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export type AppSettings = {
  dailyLimit: number;
  samalEnabled: boolean;
  sameDayCutoffHour: number;
  maxRebooks: number;
  bookingOpen: boolean;
};

function clampInt(
  value: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function ensureDefaultSettings(): Promise<void> {
  const db = await ensureDb();
  const statements = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
    sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
    args: [key, value],
  }));
  await db.batch(statements, "write");
}

export async function getSettings(): Promise<AppSettings> {
  const db = await ensureDb();
  const result = await db.execute("SELECT key, value FROM settings");
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(String(row.key), String(row.value));
  }

  return {
    dailyLimit: clampInt(map.get("daily_limit"), 1, 1000, 200),
    samalEnabled: (map.get("samal_enabled") ?? "false") === "true",
    sameDayCutoffHour: clampInt(map.get("same_day_cutoff_hour"), 0, 23, 15),
    maxRebooks: clampInt(map.get("max_rebooks"), 0, 10, 3),
    bookingOpen: (map.get("booking_open") ?? "true") === "true",
  };
}

export async function updateSettings(patch: {
  dailyLimit?: number;
  samalEnabled?: boolean;
  sameDayCutoffHour?: number;
  maxRebooks?: number;
  bookingOpen?: boolean;
}): Promise<AppSettings> {
  const db = await ensureDb();
  const entries: Array<[SettingKey, string]> = [];

  if (patch.dailyLimit !== undefined) {
    entries.push(["daily_limit", String(clampInt(String(patch.dailyLimit), 1, 1000, 200))]);
  }
  if (patch.samalEnabled !== undefined) {
    entries.push(["samal_enabled", patch.samalEnabled ? "true" : "false"]);
  }
  if (patch.sameDayCutoffHour !== undefined) {
    entries.push([
      "same_day_cutoff_hour",
      String(clampInt(String(patch.sameDayCutoffHour), 0, 23, 15)),
    ]);
  }
  if (patch.maxRebooks !== undefined) {
    entries.push(["max_rebooks", String(clampInt(String(patch.maxRebooks), 0, 10, 3))]);
  }
  if (patch.bookingOpen !== undefined) {
    entries.push(["booking_open", patch.bookingOpen ? "true" : "false"]);
  }

  if (entries.length > 0) {
    await db.batch(
      entries.map(([key, value]) => ({
        sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [key, value],
      })),
      "write",
    );
  }

  if (patch.dailyLimit !== undefined) {
    const settings = await getSettings();
    await applyDailyLimit(settings.dailyLimit);
  }

  return getSettings();
}

/**
 * Keeps existing future capacity rows in sync with the configured daily
 * limit. Rows that already have more bookings than the new limit keep their
 * current capacity so nobody is bumped out.
 */
export async function applyDailyLimit(limit: number): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "UPDATE day_capacity SET capacity = MAX(booked, ?) WHERE date >= ?",
    args: [limit, todayISO()],
  });
}

/**
 * Ensures capacity rows exist for the next `daysAhead` calendar days.
 * `INSERT OR IGNORE` leaves existing rows (and their counters) untouched.
 */
export async function ensureHorizon(daysAhead = 120): Promise<void> {
  const db = await ensureDb();
  const settings = await getSettings();
  const start = todayISO();
  const end = addDays(start, daysAhead);

  const existing = await db.execute({
    sql: "SELECT date FROM day_capacity WHERE date >= ? AND date <= ?",
    args: [start, end],
  });
  const have = new Set(existing.rows.map((row) => String(row.date)));

  const statements: Array<{ sql: string; args: Array<string | number> }> = [];
  for (let i = 0; i <= daysAhead; i += 1) {
    const date = addDays(start, i);
    if (!isOfficeDay(date) || have.has(date)) continue;
    statements.push({
      sql: "INSERT OR IGNORE INTO day_capacity (date, booked, issued, capacity) VALUES (?, 0, 0, ?)",
      args: [date, settings.dailyLimit],
    });
  }

  if (statements.length > 0) {
    await db.batch(statements, "write");
  }
}

export type DayCapacity = {
  date: string;
  booked: number;
  issued: number;
  capacity: number;
};

export async function getDayCapacity(date: string): Promise<DayCapacity | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT date, booked, issued, capacity FROM day_capacity WHERE date = ?",
    args: [date],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    date: String(row.date),
    booked: Number(row.booked),
    issued: Number(row.issued),
    capacity: Number(row.capacity),
  };
}

export type BlockedDate = {
  date: string;
  reason: string;
  createdAt: string;
};

export async function getBlockedDates(): Promise<BlockedDate[]> {
  const db = await ensureDb();
  const result = await db.execute(
    "SELECT date, reason, created_at FROM blocked_dates ORDER BY date ASC",
  );
  return result.rows.map((row) => ({
    date: String(row.date),
    reason: String(row.reason ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function isDateBlocked(date: string): Promise<boolean> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM blocked_dates WHERE date = ? LIMIT 1",
    args: [date],
  });
  return result.rows.length > 0;
}

export async function addBlockedDate(date: string, reason = ""): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "INSERT INTO blocked_dates (date, reason) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET reason = excluded.reason",
    args: [date, reason],
  });
}

export async function removeBlockedDate(date: string): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "DELETE FROM blocked_dates WHERE date = ?",
    args: [date],
  });
}

/** Used by scripts/tests to get a client plus defaults in one call. */
export async function bootstrapDb(): Promise<Client> {
  const db = await ensureDb();
  await ensureDefaultSettings();
  return db;
}
