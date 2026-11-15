import { NextResponse } from "next/server";
import { z } from "zod";
import { bookAppointment } from "@/lib/booking";
import { normalizeStudentNo } from "@/lib/names";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  studentNo: z.string().trim().min(1).max(32),
  lastName: z.string().trim().min(1).max(80),
  consent: z.boolean(),
});

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid", message: "Invalid request body." }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        code: "invalid",
        message: "Enter your Student ID, last name, and confirm your name.",
      },
      400,
    );
  }

  const key = `book:${clientKey(request)}:${normalizeStudentNo(parsed.data.studentNo)}`;
  const limit = rateLimit(key, 8, 60_000);
  if (!limit.ok) {
    return json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many booking attempts. Please wait a minute and try again.",
      },
      429,
      { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  const result = await bookAppointment(parsed.data);
  if (!result.ok) {
    const status =
      result.code === "not_found"
        ? 404
        : result.code === "error"
          ? 500
          : 409;
    return json(result, status);
  }

  return json(result, result.alreadyBooked ? 200 : 201);
}
