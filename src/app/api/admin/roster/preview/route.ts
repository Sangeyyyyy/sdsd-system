import { NextResponse } from "next/server";
import {
  parseRosterBuffer,
  previewRosterImport,
} from "@/lib/roster-import";
import { readRosterForm } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parses an uploaded workbook and reports what the import would change. */
export async function POST(request: Request) {
  const form = await readRosterForm(request);
  if (!form.ok) return form.response;

  try {
    const buffer = Buffer.from(await form.file.arrayBuffer());
    const parsed = await parseRosterBuffer(buffer, form.schoolYear);
    const preview = await previewRosterImport(parsed);
    return NextResponse.json({
      ok: true,
      filename: form.file.name,
      preview,
    });
  } catch (cause) {
    console.error("Roster preview failed", cause);
    return NextResponse.json(
      {
        ok: false,
        message:
          "The workbook could not be read. Save it as .xlsx and try again.",
      },
      { status: 400 },
    );
  }
}
