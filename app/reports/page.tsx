"use client";

import * as React from "react";
import { FileDown, FileText, Receipt } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { BarChart } from "@/components/ui/chart";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { buildSalesReport, type SalesReportData } from "@/lib/reports";
import { generateSalesReportPDF } from "@/lib/pdf";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

type RangeVal = "today" | "yesterday" | "week" | "month" | "custom";

export default function ReportsPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [range, setRange] = React.useState<RangeVal>("today");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [data, setData] = React.useState<SalesReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const d = await buildSalesReport(range, from || undefined, to || undefined);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handlePdf = () => {
    if (!data || !settings) return;
    const label =
      range === "today" ? "Today" : range === "yesterday" ? "Yesterday" : range === "week" ? "This Week" : range === "month" ? "This Month" : `${from} to ${to}`;
    generateSalesReportPDF(
      {
        title: "Sales Report",
        range: label,
        totalBills: data.totalBills,
        totalSales: data.totalSales,
        totalReceived: data.totalReceived,
        totalDiscount: data.totalDiscount,
        totalOutstanding: data.totalOutstanding,
      },
      data.daily.map((d) => ({ label: d.label, sales: d.sales, bills: d.bills })),
      data.topProducts,
      data.customerSales,
      settings
    );
    toast({ title: "Report PDF downloaded", variant: "success" });
  };

  const handleCsv = () => {
    if (!data) return;
    downloadCsv(
      ["Metric", "Total Bills", "Total Sales", "Total Received", "Total Outstanding", "Total Discount"],
      [["Total", data.totalBills, data.totalSales, data.totalReceived, data.totalOutstanding, data.totalDiscount]],
      `IMRAN-ARAIN-REPORT-${range}.csv`
    );
    toast({ title: "Report CSV downloaded", variant: "success" });
  };

  const handleProductsCsv = () => {
    if (!data) return;
    downloadCsv(
      ["Product", "Quantity Sold", "Amount"],
      data.topProducts.map((p) => [p.name, formatNumber(p.quantity), formatNumber(p.amount)]),
      "IMRAN-ARAIN-TOP-PRODUCTS.csv"
    );
  };

  return (
    <Shell>
      <PageHeader
        title="Sales Reports"
        subtitle="Daily, weekly, monthly and custom range sales analysis."
        actions={
          loading ? null : (
            <>
              <Button variant="outline" onClick={handlePdf}><FileDown /> PDF</Button>
              <Button variant="outline" onClick={handleCsv}><FileText /> CSV</Button>
            </>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-2 p-3 sm:p-4">
          <div>
            <label className="text-sm font-medium">Range</label>
            <Select value={range} onChange={(e) => setRange(e.target.value as RangeVal)} className="mt-1 h-10 w-44">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </Select>
          </div>
          {range === "custom" && (
            <>
              <div>
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-10 w-40" />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-10 w-40" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState title="No data" description="Select a range to generate the report." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Bills" value={String(data.totalBills)} icon={<Receipt />} />
            <StatCard label="Total Sales" value={`Rs. ${formatNumber(data.totalSales)}`} icon={<Receipt />} accent="green" />
            <StatCard label="Total Received" value={`Rs. ${formatNumber(data.totalReceived)}`} icon={<Receipt />} accent="blue" />
            <StatCard label="Total Outstanding" value={`Rs. ${formatNumber(data.totalOutstanding)}`} icon={<Receipt />} accent="red" />
            <StatCard label="Total Discount" value={`Rs. ${formatNumber(data.totalDiscount)}`} icon={<Receipt />} accent="amber" />
          </div>

          <Card className="mt-4">
            <CardHeader><CardTitle>Sales Trend</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="bar">
                <TabsList>
                  <TabsTrigger value="bar">Bar Chart</TabsTrigger>
                </TabsList>
                <TabsContent value="bar">
                  <BarChart data={data.daily} height={240} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
                <div className="flex">
                  <Button variant="ghost" size="sm" onClick={handleProductsCsv}><FileText /> CSV</Button>
                </div>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <EmptyState title="No product sales" description="Sell more products to see top sellers." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts.slice(0, 10).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{formatNumber(p.quantity)}</TableCell>
                          <TableCell className="text-right">Rs. {formatNumber(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Customer Sales</CardTitle></CardHeader>
              <CardContent>
                {data.customerSales.length === 0 ? (
                  <EmptyState title="No customer sales" description="Bills will be grouped by customer here." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Bills</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customerSales.slice(0, 10).map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">{c.bills}</TableCell>
                          <TableCell className="text-right">Rs. {formatNumber(c.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </Shell>
  );
}