import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
};

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect("/admin");

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to public site
        </Link>

        <div className="card p-6 sm:p-7">
          <Image
            src="/sdsd-logo.png"
            alt="SDSD logo"
            width={224}
            height={256}
            preload
            sizes="56px"
            className="h-14 w-14 object-contain"
          />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            SDSD Q
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Admin sign in
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            For SDSD staff only. Use the account provided by the office.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Students do not need an account.{" "}
          <Link href="/book" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Book a slot instead
          </Link>
        </p>
      </div>
    </div>
  );
}
