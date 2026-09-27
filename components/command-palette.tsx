"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Package, User, FileText, CornerDownLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/db/database";
import { isWeightUnit, perKgPrice, unitLabel } from "@/db/products";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

interface Item {
  type: "product" | "customer" | "bill";
  id: number;
  title: string;
  subtitle: string;
  href: string;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const router = useRouter();
  const debounced = useDebounce(query, 200);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("open-command-palette", handler);
    return () => document.removeEventListener("open-command-palette", handler);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setItems([]);
    }
  }, [open]);

  React.useEffect(() => {
    setHighlight(0);
    if (!debounced.trim() || !open) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const q = debounced.toLowerCase();
      const [products, customers, bills] = await Promise.all([
        db.products.toArray(),
        db.customers.toArray(),
        db.bills.orderBy("date").reverse().limit(50).toArray(),
      ]);
      if (cancelled) return;
      const results: Item[] = [];
      for (const p of products.filter((p) => (p.name + (p.sku || "")).toLowerCase().includes(q)).slice(0, 5)) {
        const price = isWeightUnit(p.unit) ? perKgPrice(p.sellingPrice) : p.sellingPrice;
        results.push({ type: "product", id: p.id!, title: p.name, subtitle: `Rs. ${price}/${unitLabel(p.unit)} • Stock: ${p.stock} ${unitLabel(p.unit)}`, href: "/products" });
      }
      for (const c of customers.filter((c) => (c.name + (c.phone || "")).toLowerCase().includes(q)).slice(0, 5)) {
        results.push({ type: "customer", id: c.id!, title: c.name, subtitle: c.phone || "No phone", href: `/customers/${c.id}` });
      }
      for (const b of bills.filter((b) => (b.invoiceNo + (b.customerName || "")).toLowerCase().includes(q)).slice(0, 5)) {
        results.push({ type: "bill", id: b.id!, title: b.invoiceNo, subtitle: `${b.customerName || "Walk-in"} • Rs. ${b.grandTotal}`, href: "/bills" });
      }
      setItems(results);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] max-w-2xl translate-y-0 p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && items[highlight]) {
                go(items[highlight]);
              }
            }}
            placeholder="Search products, customers, bills… (Esc to close)"
            className="h-14 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>}
          {!loading && items.length === 0 && query.trim() && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </p>
          )}
          {items.map((item, i) => {
            const Icon =
              item.type === "product" ? Package : item.type === "customer" ? User : FileText;
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => go(item)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                  i === highlight ? "bg-accent" : ""
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                {i === highlight && <CornerDownLeft className="h-4 w-4 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}