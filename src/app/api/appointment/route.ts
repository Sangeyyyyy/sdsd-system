import { NextResponse } from "next/server";
import { getAppointmentByReference } from "@/lib/booking";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export async function GET(request: Request) {
  const limit = rateLimit(`appointment:${clientKey(request)}`, 40, 60_000);
  if (!limit.ok) {
    return json(
      {
        error: "rate_limited",
        message: "Too many lookups. Please wait a minute and try again.",
      },
      429,
      { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!code.trim()) {
    return json(
      { error: "invalid", message: "Enter a reference code." },
      400,
    );
  }

  const appointment = await getAppointmentByReference(code);
  if (!appointment) {
    return json(
      {
        error: "not_found",
        message: "We could not find an appointment with that reference code.",
      },
      404,
    );
  }

  return json({ appointment });
}
