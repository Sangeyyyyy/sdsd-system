import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Admin routes are private. Keeping the noindex directive on this segment
 * layout covers the login screen, every protected page, and any future route
 * added under `/admin`.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
