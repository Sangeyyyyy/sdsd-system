import type { Metadata } from "next";
import {
  CheckCircle2,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Data Privacy Notice",
  description:
    "How SDSD Q collects, uses, and protects your personal information under the Data Privacy Act of 2012.",
  alternates: {
    canonical: "/privacy",
  },
};

const EFFECTIVE_DATE = "November 15, 2026";
const VERSION = "1.0";
const CONTACT_EMAIL = "sdsd@dnsc.edu.ph";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          <ShieldCheck className="h-4 w-4" />
          Your privacy
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Data Privacy Notice
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          SDSD Q · Student Development and Services Division, Davao del Norte
          State College
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Effective {EFFECTIVE_DATE} · Version {VERSION}
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            At a glance
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-emerald-900">
            {[
              "We collect only what is needed to schedule and verify your ID verification.",
              "No account, no password, and no birthdate, address, or grades.",
              "Only SDSD staff and authorized DNSC personnel can see your records.",
              "We never sell your data or use it for advertising.",
              `Questions? Email ${CONTACT_EMAIL} or visit the SDSD office.`,
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <article className="mt-10 space-y-9">
          <Section title="1. About this notice">
            <p>
              SDSD Q is the appointment and queue system for first-year ID
              verification at the SDSD office, DNSC Main Campus. Davao del Norte
              State College (DNSC) is the personal information controller, and
              the SDSD office runs the system.
            </p>
            <p>
              This notice explains what personal information we collect, why we
              collect it, who can see it, how long we keep it, and your rights
              under the Data Privacy Act of 2012 (RA 10173).
            </p>
          </Section>

          <Section title="2. What we collect and how long we keep it">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Where it comes from</th>
                    <th>Why we use it</th>
                    <th>How long we keep it</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium text-slate-800">
                      Student ID, full name, program, campus
                    </td>
                    <td>Official first-year roster</td>
                    <td>Match you and confirm your name</td>
                    <td>Current intake cycle</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-800">
                      Appointment date, queue number, status, reference code,
                      timestamps
                    </td>
                    <td>Generated when you book</td>
                    <td>Scheduling, verification, and audit</td>
                    <td>1 academic year after the appointment</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-800">
                      Consent timestamp
                    </td>
                    <td>You, at booking</td>
                    <td>Proof of consent</td>
                    <td>Same as the appointment</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-800">IP address</td>
                    <td>Technical</td>
                    <td>Abuse and rate limiting only</td>
                    <td>Minutes (memory only)</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-800">
                      Staff username, display name, password hash, session
                      cookie
                    </td>
                    <td>Admin accounts</td>
                    <td>Access control</td>
                    <td>While assigned; deactivated on separation</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-slate-800">Audit log</td>
                    <td>System</td>
                    <td>Accountability for status changes</td>
                    <td>1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              We do not collect sensitive personal information such as health,
              religion, grades, or financial data. Your details come from
              official student records — if something is wrong, visit the SDSD
              office so we can correct it.
            </p>
          </Section>

          <Section title="3. Why we use it">
            <Bullets
              items={[
                "Assign the earliest open office day and issue your queue number.",
                "Confirm that the name on your record is yours.",
                "Prevent duplicate or fake bookings and enforce the rebooking limit.",
                "Keep an audit trail of staff actions on appointments.",
                "Plan daily capacity (200 slots per day by default).",
              ]}
            />
            <p>
              Date assignment is a simple rule — the earliest open office day —
              not profiling or automated decision-making that produces legal
              effects.
            </p>
          </Section>

          <Section title="4. Our lawful basis">
            <p>
              We process your information with your consent when you book, and
              under DNSC&apos;s institutional mandate to maintain student records
              for ID verification. You may withdraw consent, but we may not be
              able to complete your verification without the minimum
              information.
            </p>
          </Section>

          <Section title="5. Who can see your information">
            <Bullets
              items={[
                "Authorized SDSD staff, through accounts managed by the office's super admin.",
                "Authorized DNSC IT personnel, for maintenance only.",
                "Our cloud hosting and database service providers, as processors under appropriate data processing terms.",
                "Authorities, when required by law.",
              ]}
            />
            <p>We do not sell or rent personal information.</p>
          </Section>

          <Section title="6. How we protect it">
            <Bullets
              items={[
                "Encrypted connections (HTTPS) between your browser and the system.",
                "Staff passwords are stored as bcrypt hashes, never as plain text.",
                "Staff sessions use an httpOnly cookie that expires after 8 hours.",
                "Admin access is limited to the staff who need it, and every status change is recorded in an audit log.",
                "Repeated lookup and booking attempts are rate limited.",
                "Students do not need an account, so there is no student password to steal.",
              ]}
            />
            <p>
              No system is perfectly secure. If you notice something suspicious,
              please contact the SDSD office right away.
            </p>
          </Section>

          <Section title="7. Cookies and tracking">
            <p>
              The system uses one essential cookie,{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                sdsd_admin
              </code>
              , for staff sign-in only. It expires after 8 hours. We do not use
              analytics, advertising, or tracking cookies, and students do not
              need cookies to book or view a pass.
            </p>
          </Section>

          <Section title="8. Your rights under RA 10173">
            <p>As a data subject, you have the right to:</p>
            <ul className="space-y-2">
              {[
                ["Be informed", "know how we use your personal information."],
                ["Object", "ask us to stop processing your information."],
                ["Access", "ask for a copy of the information we hold about you."],
                ["Correct", "have inaccurate information corrected."],
                ["Erase or block", "ask us to delete or block data when there is no lawful reason to keep it."],
                ["Data portability", "receive your information in a usable format."],
                ["Damages", "claim compensation for violations of your rights."],
                ["Complain", "file a complaint with the National Privacy Commission."],
              ].map(([right, description]) => (
                <li key={right} className="flex gap-2">
                  <span className="font-semibold text-slate-800">{right}</span>
                  <span>— {description}</span>
                </li>
              ))}
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              or visit the SDSD office. We verify your identity before acting on
              a request.
            </p>
            <p>
              You may also file a complaint with the National Privacy Commission
              at{" "}
              <a
                href="https://privacy.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
              >
                privacy.gov.ph
              </a>
              .
            </p>
          </Section>

          <Section title="9. Students under 18">
            <p>
              If you are under 18, a parent or guardian may contact the office on
              your behalf. We process your information under DNSC&apos;s
              institutional mandate and your consent at booking.
            </p>
          </Section>

          <Section title="10. Your reference code">
            <p>
              Your reference code (for example,{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                SDSD-ABC123
              </code>
              ) works like a key to your pass. Anyone who has it can view your
              appointment details, so share it only with people you trust.
            </p>
          </Section>

          <Section title="11. Changes to this notice">
            <p>
              We may update this notice. When we do, the effective date and
              version above will change, and material changes will be announced
              on this page.
            </p>
          </Section>
        </article>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Contact us
          </h2>
          <div className="mt-3 space-y-2.5 text-sm text-slate-600">
            <p className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              SDSD Office, Sports Complex, DNSC Main Campus
            </p>
            <p className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Privacy requests sent to the SDSD office are forwarded to DNSC&apos;s
            Data Protection Officer.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
