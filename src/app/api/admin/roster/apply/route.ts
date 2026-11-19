import { NextResponse } from "next/server";
import {
  applyRosterImport,
  parseRosterBuffer,
  previewRosterImport,
} from "@/lib/roster-import";
import { readRosterForm } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Applies an uploaded workbook. The file is parsed and validated again on
 * this request so a stale preview can never write bad data.
 */
export async function POST(request: Request) {
  const form = await readRosterForm(request);
  if (!form.ok) return form.response;

  try {
    const buffer = Buffer.from(await form.file.arrayBuffer());
    const parsed = await parseRosterBuffer(buffer, form.schoolYear);
    const preview = await previewRosterImport(parsed);

    if (!preview.canApply) {
      return NextResponse.json(
        {
          ok: false,
          message:
            preview.errors.length > 0
              ? "Fix the row errors before importing."
              : "The file has no usable student rows.",
          preview,
        },
        { status: 409 },
      );
    }

    const summary = await applyRosterImport(parsed, {
      schoolYear: form.schoolYear,
      filename: form.file.name,
      actor: form.session,
      mode: "replace",
    });

    return NextResponse.json({ ok: true, summary });
  } catch (cause) {
    console.error("Roster import failed", cause);
    return NextResponse.json(
      {
        ok: false,
        message:
          "The import failed and nothing was changed. Check the file and try again.",
      },
      { status: 500 },
    );
  }
}
