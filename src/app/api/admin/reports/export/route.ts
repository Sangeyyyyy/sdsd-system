import { getSession } from "@/lib/auth";
import { getReport, normalizeReportRange } from "@/lib/reports";

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
  const range = normalizeReportRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  const report = await getReport(range);

  const lines = [
    ["Date", "Total", "Booked", "Verified", "No-show", "Cancelled"]
      .map(csvCell)
      .join(","),
  ];

  for (const day of report.byDay) {
    lines.push(
      [
        day.date,
        day.total,
        day.booked,
        day.verified,
        day.noShow,
        day.cancelled,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  lines.push(
    [
      "TOTAL",
      report.summary.total,
      report.summary.booked,
      report.summary.verified,
      report.summary.noShow,
      report.summary.cancelled,
    ]
      .map(csvCell)
      .join(","),
  );

  // BOM helps Excel open UTF-8 names (Ñ, accents) correctly.
  const csv = `\uFEFF${lines.join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sdsd-report-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
