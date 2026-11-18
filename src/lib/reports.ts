import type { Row } from "@libsql/client";
import { ensureDb } from "./db";
import { addDays, todayISO } from "./dates";

/**
 * Office reports over a date range.
 *
 * Reports read only appointment rows, so they stay correct after a booking is
 * reset or a student is edited. Status counts mirror the queue board.
 */

export type ReportRange = {
  from: string;
  to: string;
};

export type ReportCounts = {
  total: number;
  booked: number;
  verified: number;
  noShow: number;
  cancelled: number;
};

export type ReportDay = ReportCounts & { date: string };

export type ReportGroup = ReportCounts & { label: string };

export type ReportData = {
  range: ReportRange;
  summary: ReportCounts & { students: number; days: number };
  byDay: ReportDay[];
  byProgram: ReportGroup[];
  byCampus: ReportGroup[];
};

export const REPORT_MAX_DAYS = 366;

function countColumns(alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  return `COUNT(*) AS total,
          SUM(CASE WHEN ${prefix}status = 'booked' THEN 1 ELSE 0 END) AS booked,
          SUM(CASE WHEN ${prefix}status = 'verified' THEN 1 ELSE 0 END) AS verified,
          SUM(CASE WHEN ${prefix}status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
          SUM(CASE WHEN ${prefix}status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled`;
}

function toCounts(row: Row | undefined): ReportCounts {
  return {
    total: Number(row?.total ?? 0),
    booked: Number(row?.booked ?? 0),
    verified: Number(row?.verified ?? 0),
    noShow: Number(row?.no_show ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
  };
}

/** Normalizes user input into a valid, capped range (today when unset). */
export function normalizeReportRange(
  fromParam?: string | null,
  toParam?: string | null,
): ReportRange {
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const today = todayISO();

  let to = toParam && isDate(toParam) ? toParam : today;
  let from = fromParam && isDate(fromParam) ? fromParam : addDays(to, -29);

  if (from > to) [from, to] = [to, from];

  const maxFrom = addDays(to, -(REPORT_MAX_DAYS - 1));
  if (from < maxFrom) from = maxFrom;

  return { from, to };
}

export async function getReport(range: ReportRange): Promise<ReportData> {
  const db = await ensureDb();

  const [summaryResult, dayResult, programResult, campusResult] =
    await Promise.all([
      db.execute({
        sql: `SELECT ${countColumns()},
                     COUNT(DISTINCT student_id) AS students
              FROM appointments
              WHERE appointment_date BETWEEN ? AND ?`,
        args: [range.from, range.to],
      }),
      db.execute({
        sql: `SELECT appointment_date AS date, ${countColumns()}
              FROM appointments
              WHERE appointment_date BETWEEN ? AND ?
              GROUP BY appointment_date
              ORDER BY appointment_date ASC`,
        args: [range.from, range.to],
      }),
      db.execute({
        sql: `SELECT s.program AS label, ${countColumns("a")}
              FROM appointments a
              JOIN students s ON s.id = a.student_id
              WHERE a.appointment_date BETWEEN ? AND ?
              GROUP BY s.program
              ORDER BY total DESC, label ASC`,
        args: [range.from, range.to],
      }),
      db.execute({
        sql: `SELECT s.campus AS label, ${countColumns("a")}
              FROM appointments a
              JOIN students s ON s.id = a.student_id
              WHERE a.appointment_date BETWEEN ? AND ?
              GROUP BY s.campus
              ORDER BY total DESC, label ASC`,
        args: [range.from, range.to],
      }),
    ]);

  const summaryRow = summaryResult.rows[0];

  return {
    range,
    summary: {
      ...toCounts(summaryRow),
      students: Number(summaryRow?.students ?? 0),
      days: dayResult.rows.length,
    },
    byDay: dayResult.rows.map((row) => ({
      date: String(row.date),
      ...toCounts(row),
    })),
    byProgram: programResult.rows.map((row) => ({
      label: String(row.label ?? "—"),
      ...toCounts(row),
    })),
    byCampus: campusResult.rows.map((row) => ({
      label: String(row.label ?? "MAIN"),
      ...toCounts(row),
    })),
  };
}
