"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

export function SidebarContent({
  onNavigate,
  storeName = "IMRAN ARAIN KARYANA",
}: {
  onNavigate?: () => void;
  storeName?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center gap-3 border-b pb-5 px-2 pt-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-green-900 text-sm font-bold text-white shadow-md">
          IAK
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">IMRAN ARAIN KARYANA</p>
          <p className="truncate text-xs text-muted-foreground">Billing & Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">IMRAN ARAIN KARYANA</p>
        <p className="mt-1">POS • Udhaar • Inventory</p>
        <p className="mt-1">Data is saved locally in your browser.</p>
      </div>
    </div>
  );
}