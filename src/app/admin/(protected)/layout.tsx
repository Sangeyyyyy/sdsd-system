import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return (
    <AdminShell
      displayName={session.displayName}
      role={session.role}
    >
      {children}
    </AdminShell>
  );
}
