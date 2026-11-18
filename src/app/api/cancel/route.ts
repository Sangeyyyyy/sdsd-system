import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelAppointmentByStudent } from "@/lib/booking";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(1).max(32),
});

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(`cancel:${clientKey(request)}`, 10, 60_000);
  if (!limit.ok) {
    return json(
      {
        ok: false,
        message: "Too many attempts. Please wait a minute and try again.",
      },
      429,
      { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: "Invalid request body." }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      { ok: false, message: "Enter a valid reference code." },
      400,
    );
  }

  const result = await cancelAppointmentByStudent(parsed.data.code);
  if (!result.ok) {
    return json({ ok: false, message: result.message }, 409);
  }

  return json({ ok: true });
}
