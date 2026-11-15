import Image from "next/image";
import Link from "next/link";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SDSD Q";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/sdsd-logo.png"
            alt="SDSD logo"
            width={224}
            height={256}
            preload
            sizes="40px"
            className="h-10 w-10 object-contain"
          />
          <span className="text-sm font-semibold leading-tight text-slate-900">
            {siteName}
            <span className="hidden text-slate-500 sm:inline">
              {" "}
              · ID Verification Appointments
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/lookup" className="btn-ghost">
            Find appointment
          </Link>
          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-slate-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/sdsd-logo.png"
            alt=""
            aria-hidden
            width={224}
            height={256}
            sizes="24px"
            className="h-6 w-6 object-contain"
          />
          <p>
            {siteName} · ID Verification Appointments · Student Development and
            Services Division
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <p>Office hours: Monday to Thursday. Bring your school ID.</p>
          <Link
            href="/privacy"
            className="font-semibold text-slate-600 underline underline-offset-2 transition hover:text-slate-900"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
