import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { setAppointmentsStatus } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  status: z.enum(["booked", "verified", "no_show", "cancelled"]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Select at least one appointment and a status." },
      { status: 400 },
    );
  }

  const result = await setAppointmentsStatus(
    parsed.data.ids,
    parsed.data.status,
    session,
  );

  if (result.updated === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "None of the selected appointments could be updated.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    updated: result.updated,
    failed: result.failed,
  });
}
