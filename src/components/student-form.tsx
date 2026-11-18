import Link from "next/link";
import { Save } from "lucide-react";
import type { StudentRecord } from "@/lib/booking";

type StudentFormProps = {
  action: (formData: FormData) => Promise<void> | void;
  student?: StudentRecord;
  submitLabel: string;
  cancelHref: string;
};

export function StudentForm({
  action,
  student,
  submitLabel,
  cancelHref,
}: StudentFormProps) {
  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      {student && <input type="hidden" name="id" value={student.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="studentNo">
            Student ID
          </label>
          <input
            id="studentNo"
            name="studentNo"
            className="input font-mono"
            defaultValue={student?.studentNo}
            placeholder="2026-00001"
            pattern="\d{4}-?\d{5}"
            title="Format: YYYY-NNNNN (e.g. 2026-00001)"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Format YYYY-NNNNN. Changing it changes how the student signs in.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="program">
            Program
          </label>
          <input
            id="program"
            name="program"
            className="input uppercase"
            defaultValue={student?.program}
            placeholder="BSIT"
            maxLength={40}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.2fr_0.5fr_1.2fr]">
        <div>
          <label className="label" htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            className="input"
            defaultValue={student?.firstName}
            maxLength={80}
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="middleInitial">
            M.I.
          </label>
          <input
            id="middleInitial"
            name="middleInitial"
            className="input uppercase"
            defaultValue={student?.middleInitial}
            maxLength={5}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="label" htmlFor="lastName">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            className="input"
            defaultValue={student?.lastName}
            maxLength={80}
            autoComplete="off"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="campus">
            Campus
          </label>
          <select
            id="campus"
            name="campus"
            className="input"
            defaultValue={student?.campus === "SAMAL" ? "SAMAL" : "MAIN"}
          >
            <option value="MAIN">Main campus</option>
            <option value="SAMAL">SAMAL campus</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="yearLevel">
            Year level
          </label>
          <select
            id="yearLevel"
            name="yearLevel"
            className="input"
            defaultValue={String(student?.yearLevel ?? 1)}
          >
            {[1, 2, 3, 4, 5].map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="btn-secondary">
          Cancel
        </Link>
        <button type="submit" className="btn-primary">
          <Save className="h-4 w-4" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
