import { getSession } from "@/lib/auth";
import { normalizeSchoolYear } from "@/lib/school-year";
import { buildRosterTemplate } from "@/lib/roster-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads a blank, correctly-shaped roster workbook. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (session.role !== "super_admin") {
    return new Response("Only a super admin can download the template.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const schoolYear = normalizeSchoolYear(url.searchParams.get("year"));
  if (!schoolYear) {
    return new Response("School year must look like 2027-2028.", {
      status: 400,
    });
  }

  const buffer = await buildRosterTemplate(schoolYear);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roster-${schoolYear}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
