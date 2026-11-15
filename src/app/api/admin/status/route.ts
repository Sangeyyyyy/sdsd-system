import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { setAppointmentStatus } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.number().int().positive(),
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
      { ok: false, message: "Invalid appointment id or status." },
      { status: 400 },
    );
  }

  const result = await setAppointmentStatus(
    parsed.data.id,
    parsed.data.status,
    session,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message ?? "Could not update status." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
