import { ensureDb } from "./db";

/**
 * Maintenance operations that are intentionally kept out of the normal
 * booking/admin flows.
 */

export type ResetBookingsResult = {
  appointments: number;
  days: number;
};

/**
 * Permanently deletes every appointment and resets the queue counters for
 * every office day.
 *
 * What this does:
 * - removes all booked, verified, no-show, and cancelled appointments
 * - resets `day_capacity.booked` and `day_capacity.issued` to 0
 *
 * What this keeps:
 * - the student roster
 * - admin accounts and sessions
 * - settings and blocked dates
 * - the audit log (a new `bookings.reset` entry is added)
 *
 * Because rebooking limits and "already verified" checks are derived from
 * appointment rows, clearing them also resets every student's rebook count
 * and lets them book again.
 */
export async function resetAllBookings(admin: {
  id: number;
  displayName: string;
}): Promise<ResetBookingsResult> {
  const db = await ensureDb();
  const tx = await db.transaction("write");

  try {
    const appointmentCount = await tx.execute(
      "SELECT COUNT(*) AS n FROM appointments",
    );
    const appointments = Number(appointmentCount.rows[0]?.n ?? 0);

    const dayCount = await tx.execute(
      "SELECT COUNT(*) AS n FROM day_capacity WHERE booked > 0 OR issued > 0",
    );
    const days = Number(dayCount.rows[0]?.n ?? 0);

    await tx.execute("DELETE FROM appointments");
    await tx.execute("UPDATE day_capacity SET booked = 0, issued = 0");

    await tx.execute({
      sql: `INSERT INTO audit_log (admin_id, action, appointment_id, details)
            VALUES (?, 'bookings.reset', NULL, ?)`,
      args: [
        admin.id,
        `${appointments} appointment(s) deleted; ${days} day counter(s) reset by ${admin.displayName}`,
      ],
    });

    await tx.commit();
    return { appointments, days };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // The transaction may already be closed.
    }
    throw error;
  }
}
