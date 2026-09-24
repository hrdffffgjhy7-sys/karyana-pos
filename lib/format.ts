import type { AppSettings } from "@/types";

const fmtNumber = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 2,
});

export function formatNumber(n: number): string {
  if (!isFinite(n)) return "0";
  return fmtNumber.format(Math.round(n * 100) / 100);
}

export function formatMoney(n: number, settings?: AppSettings): string {
  const sym = settings?.currencySymbol || "Rs.";
  return `${sym} ${formatNumber(n)}`;
}

export function formatDate(ts: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
}

export function formatTime(ts: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfDay(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dateRangeLabel(ts: number): string {
  return formatDate(ts);
}