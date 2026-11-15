import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupStudent } from "@/lib/booking";
import { normalizeStudentNo } from "@/lib/names";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  studentNo: z.string().trim().min(1).max(32),
  lastName: z.string().trim().min(1).max(80),
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
    return json(
      { error: "invalid", message: "Invalid request body." },
      400,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "invalid",
        message: "Enter your Student ID and last name.",
      },
      400,
    );
  }

  const key = `lookup:${clientKey(request)}:${normalizeStudentNo(parsed.data.studentNo)}`;
  const limit = rateLimit(key, 15, 60_000);
  if (!limit.ok) {
    return json(
      {
        error: "rate_limited",
        message:
          "Too many attempts. Please wait a minute and try again.",
      },
      429,
      { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  const result = await lookupStudent(
    parsed.data.studentNo,
    parsed.data.lastName,
  );

  if (!result) {
    return json(
      {
        error: "not_found",
        message:
          "We could not find that Student ID and last name. Please check and try again.",
      },
      404,
    );
  }

  return json(result);
}
