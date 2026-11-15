"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/lib/auth";

const LINKS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  superOnly?: boolean;
}> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Activity", icon: ScrollText, superOnly: true },
  { href: "/admin/users", label: "Accounts", icon: UserCog, superOnly: true },
];

export function AdminShell({
  displayName,
  role,
  children,
}: {
  displayName: string;
  role: AdminRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const links = LINKS.filter(
    (link) => !link.superOnly || role === "super_admin",
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Image
                src="/sdsd-logo.png"
                alt="SDSD logo"
                width={224}
                height={256}
                preload
                sizes="36px"
                className="h-9 w-9 object-contain"
              />
              <span>
                <span className="block text-sm font-semibold leading-tight text-slate-900">
                  SDSD Q Admin
                </span>
                <span className="block text-xs text-slate-500">
                  ID verification appointments
                </span>
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 lg:hidden"
            >
              Public site
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex flex-1 items-center gap-1 overflow-x-auto lg:flex-none">
              {links.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/admin" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <Link
                href="/admin/account"
                className="hidden text-right sm:block"
                title="My account"
              >
                <p className="max-w-[10rem] truncate text-xs font-semibold text-slate-800 hover:text-indigo-700">
                  {displayName}
                </p>
                {role === "super_admin" && (
                  <p className="text-[11px] text-indigo-600">Super admin</p>
                )}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="btn-ghost"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
