import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAppointments } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date") ?? "";
  const queueParam = Number.parseInt(url.searchParams.get("queue") ?? "", 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam) || !Number.isInteger(queueParam)) {
    return NextResponse.json(
      { ok: false, message: "Provide a date and a queue number." },
      { status: 400 },
    );
  }

  const rows = await listAppointments({
    date: dateParam,
    queue: queueParam,
    limit: 1,
    offset: 0,
  });

  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "No appointment with that queue number on this date.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, appointment: rows[0] });
}
