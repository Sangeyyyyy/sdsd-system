import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking-wizard";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Book a slot",
  description:
    "Reserve your first-year ID verification slot at the SDSD office. Choose an open day, get your queue number, and screenshot your pass.",
  alternates: {
    canonical: "/book",
  },
};

export default function BookPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Book your ID verification slot
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Enter your Student ID and last name. We will assign the earliest
            open office day automatically.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <BookingWizard />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          No account needed. Your booking is confirmed on screen — take a
          screenshot.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
