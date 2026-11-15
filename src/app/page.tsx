import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  IdCard,
  Search,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getNextOpenDate } from "@/lib/booking";
import { formatLongDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  const settings = await getSettings();
  const nextDate = await getNextOpenDate();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="hero-glow border-b border-slate-200/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
            <div>
              <span className="badge border border-gold-300 bg-gold-100 text-brand-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                First-year ID verification
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Reserve your slot.
                <span className="block text-indigo-600">Skip the line.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                Book your in-person ID verification at the SDSD office in under a
                minute. No account and no password — just your Student ID and
                last name.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/book" className="btn-primary px-6 py-3 text-base">
                  Book my slot
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/lookup" className="btn-secondary px-6 py-3 text-base">
                  <Search className="h-4 w-4" />
                  Find my appointment
                </Link>
              </div>

              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                {!settings.bookingOpen ? (
                  <span className="font-medium text-amber-700">
                    Booking is temporarily closed. Please check back later.
                  </span>
                ) : nextDate ? (
                  <>
                    Next available office day:{" "}
                    <strong className="font-semibold text-slate-700">
                      {formatLongDate(nextDate)}
                    </strong>
                  </>
                ) : (
                  <span className="font-medium text-amber-700">
                    All upcoming slots are full. Please check back later.
                  </span>
                )}
              </p>
            </div>

            <div className="card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  How it works
                </h2>
                <Ticket className="h-5 w-5 text-indigo-500" />
              </div>
              <ol className="mt-5 space-y-5">
                {[
                  {
                    title: "Enter your Student ID and last name",
                    body: "We match you against the official first-year roster.",
                  },
                  {
                    title: "Confirm your name",
                    body: "Make sure the first name shown is really you.",
                  },
                  {
                    title: "Get your queue number",
                    body: "The earliest open office day is assigned automatically.",
                  },
                  {
                    title: "Screenshot your pass",
                    body: "Bring it with your school ID on your appointment day.",
                  },
                ].map((item, index) => (
                  <li key={item.title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: CalendarCheck,
                title: "Monday to Thursday",
                body: "The office accepts students four days a week.",
              },
              {
                icon: Users,
                title: `${settings.dailyLimit} slots per day`,
                body: "Queue numbers fill the earliest open day first.",
              },
              {
                icon: Clock,
                title: "Whole-day queue",
                body: "No time slots. Your number is valid for the day.",
              },
              {
                icon: IdCard,
                title: "Bring your school ID",
                body: "Staff will verify your identity in person.",
              },
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Before you come
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {[
                  "Bring your school ID or a printed enrollment certificate.",
                  "Arrive during office hours on your assigned date.",
                  "Keep a screenshot of your pass — it is your only confirmation.",
                  "If you miss your date, you can rebook up to three times.",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Need help?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                If your Student ID is not found, or your name does not match the
                roster, visit the SDSD office and ask the staff to check your
                record. Do not create a second booking.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/book" className="btn-primary">
                  Book a slot
                </Link>
                <Link href="/lookup" className="btn-secondary">
                  Check my booking
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
