import { NextResponse } from "next/server";
import { getSession, type AdminSession } from "@/lib/auth";
import { normalizeSchoolYear } from "@/lib/school-year";

/** Shared guards for the roster import endpoints. */

export const MAX_ROSTER_BYTES = 10 * 1024 * 1024;

export type RosterForm =
  | {
      ok: true;
      session: AdminSession;
      file: File;
      schoolYear: string;
    }
  | { ok: false; response: NextResponse };

function error(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function readRosterForm(request: Request): Promise<RosterForm> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: error("Unauthorized.", 401) };
  }
  if (session.role !== "super_admin") {
    return {
      ok: false,
      response: error("Only a super admin can import a roster.", 403),
    };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, response: error("Invalid upload.", 400) };
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false, response: error("Choose an .xlsx roster file.", 400) };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      ok: false,
      response: error("The roster must be an .xlsx workbook.", 400),
    };
  }
  if (file.size === 0) {
    return { ok: false, response: error("The file is empty.", 400) };
  }
  if (file.size > MAX_ROSTER_BYTES) {
    return {
      ok: false,
      response: error("The workbook is larger than 10 MB.", 413),
    };
  }

  const schoolYear = normalizeSchoolYear(form.get("schoolYear"));
  if (!schoolYear) {
    return {
      ok: false,
      response: error("School year must look like 2027-2028.", 400),
    };
  }

  return { ok: true, session, file, schoolYear };
}
