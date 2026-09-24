"use client";

import * as React from "react";
import { Files, Users, BarChart3, Package, DatabaseBackup, FileDown, FileText } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce";
import { listBills, getBillWithItems, type BillListFilter } from "@/db/bills";
import { listCustomers } from "@/db/customers";
import { listProducts, perKgPrice } from "@/db/products";
import { listPayments } from "@/db/payments";
import { generateInvoicePDF, generateStatementPDF, generateSalesReportPDF, generateProductsPDF, generateUdhaarReportPDF, generatePaymentsLogPDF } from "@/lib/pdf";
import { downloadCsv } from "@/lib/csv";
import { exportBackup } from "@/lib/backup";
import { buildSalesReport } from "@/lib/reports";
import { formatDate, formatNumber } from "@/lib/format";
import type { Bill, Customer, Product } from "@/types";

export default function DownloadsPage() {
  const { settings } = useSettings();
  const { toast } = useToast();

  const [bills, setBills] = React.useState<Bill[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [billSearch, setBillSearch] = React.useState("");
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [billRange, setBillRange] = React.useState<NonNullable<BillListFilter["range"]>>("month");
  const dBillSearch = useDebounce(billSearch, 250);
  const dCustomerSearch = useDebounce(customerSearch, 250);

  React.useEffect(() => {
    (async () => {
      const [b, c, p] = await Promise.all([
        listBills({ range: billRange, search: dBillSearch }),
        listCustomers(dCustomerSearch),
        listProducts({}),
      ]);
      setBills(b.slice(0, 100));
      setCustomers(c);
      setProducts(p);
    })();
  }, [billRange, dBillSearch, dCustomerSearch]);

  const downloadBill = async (id: number) => {
    if (!settings) return;
    const bill = await getBillWithItems(id);
    if (!bill) return;
    await generateInvoicePDF(bill, bill.items, settings);
    toast({ title: "PDF downloaded", description: `${bill.invoiceNo} saved.`, variant: "success" });
  };

  const downloadStatementPdf = async (c: Customer) => {
    if (!settings) return;
    const { getCustomerTransactions, calculateCustomerBalance } = await import("@/db/customers");
    const [bal, t] = await Promise.all([calculateCustomerBalance(c.id!), getCustomerTransactions(c.id!)]);
    await generateStatementPDF(c, t.transactions as never, bal.currentBalance, settings);
    toast({ title: "Statement downloaded", description: `${c.name} PDF saved.`, variant: "success" });
  };

  const downloadStatementCsv = (c: Customer) => {
    downloadCsv(
      ["Date", "Type", "Invoice", "Amount", "Method"],
      [["Account Statement", c.name, c.phone, "", ""]],
      `IMRAN-ARAIN-STATEMENT-${c.name.replace(/[^a-zA-Z0-9]+/g, "-").toUpperCase()}.csv`
    );
    toast({ title: "CSV downloaded", description: `${c.name} statement CSV saved.`, variant: "success" });
  };

  const reportPdf = async (range: string, from?: string, to?: string) => {
    try {
      if (!settings) return;
      const d = await buildSalesReport(range, from, to);
      const label = range === "all" ? "All Time" : `${from || range}${to ? ` to ${to}` : ""}`;
      generateSalesReportPDF(
        {
          title: "Sales Report",
          range: label,
          totalBills: d.totalBills,
          totalSales: d.totalSales,
          totalReceived: d.totalReceived,
          totalDiscount: d.totalDiscount,
          totalOutstanding: d.totalOutstanding,
        },
        d.daily.map((x) => ({ label: x.label, sales: x.sales, bills: x.bills })),
        d.topProducts,
        d.customerSales,
        settings
      );
      toast({ title: "Report PDF downloaded", variant: "success" });
    } catch {
      toast({ title: "Could not create report", variant: "destructive" });
    }
  };

  const reportCsv = async (range: string) => {
    try {
      const d = await buildSalesReport(range);
      downloadCsv(
        ["Metric", "Bills", "Sales", "Received", "Discount"],
        [["Total", d.totalBills, d.totalSales, d.totalReceived, d.totalDiscount]],
        `IMRAN-ARAIN-REPORT-${range}.csv`
      );
      toast({ title: "Report CSV downloaded", variant: "success" });
    } catch {
      toast({ title: "Could not create report", variant: "destructive" });
    }
  };

  const productsPdf = () => {
    try {
      if (!settings || !products.length) return;
      generateProductsPDF(
        products.map((p) => ({
          ...p,
          purchasePrice: perKgPrice(p.purchasePrice),
          sellingPrice: perKgPrice(p.sellingPrice),
        })),
        settings,
        "All"
      );
      toast({ title: "Products PDF downloaded", variant: "success" });
    } catch {
      toast({ title: "Could not create PDF", variant: "destructive" });
    }
  };

  const productsCsv = () => {
    downloadCsv(
      ["Product", "SKU", "Barcode", "Category", "Purchase (Rs/KG)", "Selling (Rs/KG)", "Stock (g)", "Min Stock (g)", "Unit"],
      products.map((p) => [p.name, p.sku, p.barcode, p.category, perKgPrice(p.purchasePrice), perKgPrice(p.sellingPrice), p.stock, p.minStock, p.unit]),
      "IMRAN-ARAIN-PRODUCTS.csv"
    );
    toast({ title: "Products CSV downloaded", variant: "success" });
  };

  const backup = async () => {
    try {
      await exportBackup();
      toast({ title: "Backup downloaded", description: "Complete JSON backup saved.", variant: "success" });
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    }
  };

  const udhaarReport = async () => {
    try {
      if (!settings) return;
      const { getAllCustomerBalances } = await import("@/db/customers");
      const rows = await getAllCustomerBalances();
      generateUdhaarReportPDF(
        rows.map((r) => ({ name: r.name, phone: r.phone, balance: r.currentBalance, purchases: r.totalPurchases, paid: r.totalPaid })),
        rows.reduce((s, r) => s + Math.max(r.currentBalance, 0), 0),
        settings
      );
      toast({ title: "Udhaar report downloaded", variant: "success" });
    } catch {
      toast({ title: "Could not create report", variant: "destructive" });
    }
  };

  const paymentsLog = async () => {
    try {
      if (!settings) return;
      const payments = await listPayments({});
      generatePaymentsLogPDF(payments, settings);
      toast({ title: "Payments log downloaded", variant: "success" });
    } catch {
      toast({ title: "Could not create report", variant: "destructive" });
    }
  };

  const Section = ({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><span className="text-primary">{icon}</span> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  return (
    <Shell>
      <PageHeader
        title="IMRAN ARAIN KARYANA — Download Center"
        subtitle="Download PDF bills, statements, reports, product lists and full backups."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={<Files />} title="Bills" description="Download individual PDF invoices.">
          <div className="mb-2 flex gap-2">
            <Input value={billSearch} onChange={(e) => setBillSearch(e.target.value)} placeholder="Search bill or customer…" className="h-9 flex-1" />
            <Select value={billRange} onChange={(e) => setBillRange(e.target.value as NonNullable<BillListFilter["range"]>)} className="h-9 w-36">
              <option value="today">Today</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="all">All Time</option>
            </Select>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {bills.length === 0 ? (
              <EmptyState title="No bills" description="Adjust the filters." />
            ) : (
              bills.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{b.invoiceNo}</p>
                    <p className="text-xs text-muted-foreground">{b.customerName} • {formatDate(b.date)} • Rs. {formatNumber(b.grandTotal)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadBill(b.id!)}><FileDown /> PDF</Button>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section icon={<Users />} title="Customer Statements" description="Download PDF or CSV for any customer.">
          <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customer…" className="mb-2 h-9" />
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {customers.length === 0 ? (
              <EmptyState title="No customers" description="Add customers first." />
            ) : (
              customers.slice(0, 50).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => downloadStatementCsv(c)}><FileText /></Button>
                    <Button size="sm" variant="outline" onClick={() => downloadStatementPdf(c)}><FileDown /> PDF</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section icon={<BarChart3 />} title="Sales Reports" description="Quick PDF and CSV sales reports.">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => reportPdf("today")}><FileDown /> Today PDF</Button>
            <Button variant="outline" onClick={() => reportCsv("today")}><FileText /> Today CSV</Button>
            <Button variant="outline" onClick={() => reportPdf("week")}><FileDown /> Week PDF</Button>
            <Button variant="outline" onClick={() => reportCsv("week")}><FileText /> Week CSV</Button>
            <Button variant="outline" onClick={() => reportPdf("month")}><FileDown /> Month PDF</Button>
            <Button variant="outline" onClick={() => reportCsv("month")}><FileText /> Month CSV</Button>
            <Button variant="outline" onClick={() => udhaarReport()}><FileDown /> Udhaar PDF</Button>
            <Button variant="outline" onClick={() => paymentsLog()}><FileDown /> Payments PDF</Button>
          </div>
        </Section>

        <Section icon={<Package />} title="Products" description="Download the full product list.">
          <p className="mb-3 text-sm text-muted-foreground">{products.length} products in inventory.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={productsPdf}><FileDown /> PDF</Button>
            <Button variant="outline" onClick={productsCsv}><FileText /> CSV</Button>
          </div>
        </Section>

        <Section icon={<DatabaseBackup />} title="Complete Backup" description="Download the full database as JSON.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Includes products, customers, bills, bill items, payments, stock movements and settings.</p>
            <Button onClick={() => backup()}><DatabaseBackup /> Download JSON Backup</Button>
          </div>
        </Section>
      </div>
    </Shell>
  );
}