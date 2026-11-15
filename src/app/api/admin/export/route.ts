import { getSession } from "@/lib/auth";
import { listAppointments } from "@/lib/queries";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const query = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const campus = url.searchParams.get("campus") ?? "";

  const rows = await listAppointments({
    date,
    query,
    status,
    campus,
    limit: 5000,
    offset: 0,
  });

  const header = [
    "Queue number",
    "Student ID",
    "Full name",
    "Program",
    "Campus",
    "Status",
    "Appointment date",
    "Reference code",
    "Booked at (UTC)",
    "Verified at (UTC)",
    "Verified by",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.queueNumber,
        row.studentNo,
        row.fullName,
        row.program,
        row.campus,
        row.status,
        row.date,
        row.referenceCode,
        row.bookedAt,
        row.verifiedAt ?? "",
        row.verifiedBy ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // BOM helps Excel open UTF-8 names (Ñ, accents) correctly.
  const csv = `\uFEFF${lines.join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sdsd-appointments-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
