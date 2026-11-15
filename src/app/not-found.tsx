import Link from "next/link";
import { SearchX } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <SearchX className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          We could not find that page
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          The reference code may be mistyped, or the appointment may no longer
          exist. Check your code and try again.
        </p>
        <div className="mt-6 flex gap-2">
          <Link href="/lookup" className="btn-primary">
            Find my appointment
          </Link>
          <Link href="/" className="btn-secondary">
            Go home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
