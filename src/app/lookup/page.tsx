import type { Metadata } from "next";
import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Find my appointment",
  description:
    "Look up your ID verification appointment with your Student ID and last name. See your date, queue number, and pass.",
  alternates: {
    canonical: "/lookup",
  },
};

export default function LookupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Find my appointment
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Use your reference code, or your Student ID and last name.
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <LookupForm />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Need a new slot?{" "}
          <Link href="/book" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Book an appointment
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
