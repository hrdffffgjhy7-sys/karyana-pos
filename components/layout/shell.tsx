"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { SidebarContent } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find(
    (n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))
  );
  const title = current?.title ?? (pathname.startsWith("/customers") ? "Customer" : "IMRAN ARAIN KARYANA");

  const openSearch = () =>
    document.dispatchEvent(new CustomEvent("open-command-palette"));

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card p-4 lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarContent onNavigate={() => {}} />
            </SheetContent>
          </Sheet>

          <span className="truncate text-sm font-semibold sm:text-base">{title}</span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden text-muted-foreground sm:inline-flex"
              onClick={openSearch}
            >
              <Search className="mr-1" />
              Search
              <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                Ctrl K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={openSearch}
              aria-label="Search"
            >
              <Search />
            </Button>
            <Link href="/bill/new">
              <Button size="sm" className="hidden sm:inline-flex">
                <Plus /> New Bill
              </Button>
              <Button size="icon" className="sm:hidden" aria-label="New bill">
                <Plus />
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-3 sm:p-5 lg:p-6">{children}</main>

        <footer className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
          IMRAN ARAIN KARYANA — Billing &amp; Management • All data stored locally in your browser
        </footer>
      </div>
    </div>
  );
}