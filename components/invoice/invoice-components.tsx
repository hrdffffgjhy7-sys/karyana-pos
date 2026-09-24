"use client";

import * as React from "react";
import { Printer, FileDown, MessageCircle, Trash2 } from "lucide-react";
import type { AppSettings, Bill, BillItem } from "@/types";
import { printInvoice } from "@/lib/print";
import { generateInvoicePDF } from "@/lib/pdf";
import { buildBillWhatsApp, openWhatsApp } from "@/lib/whatsapp";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { formatNumber, formatDateTime } from "@/lib/format";

export function InvoiceActions({
  bill,
  items,
  settings,
  onDelete,
}: {
  bill: Bill;
  items: BillItem[];
  settings: AppSettings;
  onDelete?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const handlePrint = async () => {
    try {
      await printInvoice(settings, bill, items);
    } catch (e) {
      toast({ title: "Could not print", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePdf = async () => {
    setBusy(true);
    try {
      await generateInvoicePDF(bill, items, settings);
      toast({ title: "PDF downloaded", description: `${bill.invoiceNo} saved as PDF`, variant: "success" });
    } catch {
      toast({ title: "PDF failed", description: "Could not generate the PDF bill.", variant: "destructive" });
    }
    setBusy(false);
  };

  const handleWhatsApp = () => {
    const message = buildBillWhatsApp(settings, bill, items);
    const ok = openWhatsApp(bill.customerPhone, message);
    if (!ok) toast({ title: "No phone number", description: "Add the customer phone number to send the bill on WhatsApp.", variant: "destructive" });
    else toast({ title: "WhatsApp opened", description: "Send the bill from the opened chat." });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={handlePrint}>
        <Printer /> Print
      </Button>
      <Button size="sm" variant="outline" onClick={handlePdf} disabled={busy}>
        <FileDown /> PDF
      </Button>
      {bill.customerPhone && (
        <Button size="sm" variant="outline" onClick={handleWhatsApp} className="text-green-600 dark:text-green-500">
          <MessageCircle /> WhatsApp
        </Button>
      )}
      {onDelete && (
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 /> Delete
        </Button>
      )}
    </div>
  );
}

export function InvoiceView({
  bill,
  items,
  settings,
}: {
  bill: Bill;
  items: BillItem[];
  settings: AppSettings;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 text-sm sm:p-6">
      <div className="flex items-start justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-base font-bold">{settings.storeName}</p>
          <p className="text-xs text-muted-foreground">{settings.address}</p>
          <p className="text-xs text-muted-foreground">Phone: {settings.phone}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{bill.invoiceNo}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(bill.date)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Customer</p>
          <p className="font-medium">{bill.customerName || "Walk-in Customer"}</p>
          {bill.customerPhone && <p>{bill.customerPhone}</p>}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Items</p>
          <p className="font-medium">{bill.itemsCount} items</p>
          <p className="text-muted-foreground">{bill.paymentMethod}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-2">Item</th>
              <th className="px-2 text-right">Qty</th>
              <th className="px-2 text-right">Rate</th>
              <th className="py-2 pl-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-dashed last:border-0">
                <td className="py-1.5 pr-2">{it.name}</td>
                <td className="px-2 text-right">
                  {formatNumber(it.quantity)} {it.unit}
                </td>
                <td className="px-2 text-right">{formatNumber(it.unitPrice)}</td>
                <td className="py-1.5 pl-2 text-right font-medium">{formatNumber(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 ml-auto max-w-xs space-y-1">
        <Row label="Subtotal" value={`Rs. ${formatNumber(bill.subtotal)}`} />
        {bill.discount > 0 && <Row label="Discount" value={`- Rs. ${formatNumber(bill.discount)}`} />}
        {bill.previousBalance > 0 && (
          <Row label="Previous Balance" value={`Rs. ${formatNumber(bill.previousBalance)}`} />
        )}
        <div className="border-t pt-1 font-bold">
          <Row label="Grand Total" value={`Rs. ${formatNumber(bill.grandTotal)}`} />
        </div>
        <Row label="Paid" value={`Rs. ${formatNumber(bill.paid)}`} />
        <div className="font-bold text-primary">
          <Row label={bill.remainingBalance >= 0 ? "Remaining" : "Advance"} value={`Rs. ${formatNumber(Math.abs(bill.remainingBalance))}`} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}