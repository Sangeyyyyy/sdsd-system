"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Re-renders a server page on a timer so the queue stays current without a
 * manual reload. Refreshes pause while the tab is hidden and run once when the
 * staff member returns to the tab.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setUpdatedAt(
        new Date().toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }

    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [intervalMs, router]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
      title={`Refreshes automatically every ${Math.round(intervalMs / 1000)} seconds while this tab is open.`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Live
      {updatedAt && (
        <span className="font-normal text-emerald-600">· {updatedAt}</span>
      )}
    </span>
  );
}
