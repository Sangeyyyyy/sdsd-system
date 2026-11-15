import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  booked: "bg-gold-100 text-gold-800",
  verified: "bg-emerald-100 text-emerald-700",
  no_show: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-600",
};

const LABELS: Record<string, string> = {
  booked: "Booked",
  verified: "Verified",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "badge",
        STYLES[status] ?? "bg-slate-100 text-slate-600",
        className,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
