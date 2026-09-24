"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Trash2, Search, SlidersHorizontal } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce";
import { listBills, getBillWithItems, deleteBill, type BillListFilter, type BillWithItems } from "@/db/bills";
import type { Bill } from "@/types";
import { formatDate, formatTime, formatNumber } from "@/lib/format";
import { InvoiceView, InvoiceActions } from "@/components/invoice/invoice-components";

type Range = NonNullable<BillListFilter["range"]>;

export default function BillsPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState<Range>("today");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 250);

  const [viewBill, setViewBill] = React.useState<BillWithItems | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Bill | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const rows = await listBills({
      range,
      from: range === "custom" && from ? new Date(from).getTime() : undefined,
      to: range === "custom" && to ? new Date(to).getTime() : undefined,
      search: debouncedSearch,
    });
    setBills(rows);
    setLoading(false);
  }, [range, from, to, debouncedSearch]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openBill = async (id: number) => {
    const b = await getBillWithItems(id);
    if (b) setViewBill(b);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBill(deleteTarget.id!);
      toast({ title: "Bill deleted", description: `${deleteTarget.invoiceNo} was permanently deleted.` });
      setDeleteTarget(null);
      if (viewBill?.id === deleteTarget.id) setViewBill(null);
      load();
    } catch {
      toast({ title: "Delete failed", description: "Could not delete the bill.", variant: "destructive" });
    }
    setDeleting(false);
  };

  const totalSales = bills.reduce((s, b) => s + b.grandTotal, 0);
  const totalReceived = bills.reduce((s, b) => s + b.paid, 0);

  return (
    <Shell>
      <PageHeader
        title="Bill History"
        subtitle={`${bills.length} bill${bills.length === 1 ? "" : "s"} • Sales ${settings?.currencySymbol ?? "Rs."} ${formatNumber(totalSales)} • Received ${settings?.currencySymbol ?? "Rs."} ${formatNumber(totalReceived)}`}
        actions={<Button asChild><Link href="/bill/new">+ New Bill</Link></Button>}
      />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice no, customer, phone…"
                className="h-10 pl-9"
              />
            </div>
            <Select value={range} onChange={(e) => setRange(e.target.value as Range)} className="h-10 w-40">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date</option>
              <option value="all">All Time</option>
            </Select>
            {range === "custom" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-36" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-36" />
              </>
            )}
            <Button variant="outline" size="icon" className="h-10" onClick={load} title="Refresh">
              <SlidersHorizontal />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : bills.length === 0 ? (
            <EmptyState
              title="No bills found"
              description="Change the filters or create a new bill."
              action={<Button asChild><Link href="/bill/new">New Bill</Link></Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-semibold">{b.invoiceNo}</TableCell>
                      <TableCell>
                        {formatDate(b.date)}
                        <span className="block text-xs text-muted-foreground">{formatTime(b.date)}</span>
                      </TableCell>
                      <TableCell>{b.customerName || "Walk-in Customer"}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(b.grandTotal)}</TableCell>
                      <TableCell className="text-right">{formatNumber(b.paid)}</TableCell>
                      <TableCell className={`text-right ${b.remainingBalance > 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                        {formatNumber(b.remainingBalance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === "Paid" ? "success" : b.status === "Partial" ? "info" : "warning"}>
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="iconSm" onClick={() => openBill(b.id!)} title="View">
                            <Eye />
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => setDeleteTarget(b)} className="text-muted-foreground hover:text-destructive" title="Delete">
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewBill} onOpenChange={(o) => !o && setViewBill(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill {viewBill?.invoiceNo}</DialogTitle>
          </DialogHeader>
          {viewBill && settings && (
            <>
              <InvoiceView bill={viewBill} items={viewBill.items} settings={settings} />
              <div className="mt-2">
                <InvoiceActions
                  bill={viewBill}
                  items={viewBill.items}
                  settings={settings}
                  onDelete={() => setDeleteTarget(viewBill)}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete bill <strong>{deleteTarget?.invoiceNo}</strong>, its items, and linked
              payment record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Bill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}