import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  sub,
  accent = "default",
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  accent?: "default" | "green" | "red" | "amber" | "blue";
  onClick?: () => void;
}) {
  const accentMap: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", accentMap[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}