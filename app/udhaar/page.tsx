"use client";

import * as React from "react";
import Link from "next/link";
import { HandCoins, Users, Wallet, ArrowUpLeft, MessageCircle, FileDown, FileText } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { getAllCustomerBalances } from "@/db/customers";
import { listRecentPayments } from "@/db/payments";
import { getTotalUdhaar } from "@/db/stats";
import type { Customer, Payment } from "@/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { generateUdhaarReportPDF, generatePaymentsLogPDF } from "@/lib/pdf";
import { downloadCsv } from "@/lib/csv";
import { buildUdhaarReminder, openWhatsApp } from "@/lib/whatsapp";

export default function UdhaarPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<ReturnType<typeof buildRows>>([]);
  const [totalOutstanding, setTotalOutstanding] = React.useState(0);
  const [recent, setRecent] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [customerRows, udhaar, payments] = await Promise.all([
      getAllCustomerBalances(),
      getTotalUdhaar(),
      listRecentPayments(15),
    ]);
    setRows(buildRows(customerRows));
    setTotalOutstanding(udhaar);
    setRecent(payments);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const todayPayments = recent.filter((p) => p.date >= todayStart());

  const handlePdf = () => {
    if (!settings) return;
    generateUdhaarReportPDF(
      rows.map((r) => ({ name: r.name, phone: r.phone, balance: r.balance, purchases: r.totalPurchases, paid: r.totalPaid })),
      totalOutstanding,
      settings
    );
    toast({ title: "Udhaar report downloaded", variant: "success" });
  };

  const handleCsv = () => {
    downloadCsv(
      ["Customer", "Phone", "Purchases", "Paid", "Outstanding"],
      rows.map((r) => [r.name, r.phone, formatNumber(r.totalPurchases), formatNumber(r.totalPaid), formatNumber(r.balance)]),
      "IMRAN-ARAIN-UDHAAR-REPORT.csv"
    );
    toast({ title: "CSV report downloaded", variant: "success" });
  };

  const handlePaymentsPdf = () => {
    if (!settings) return;
    generatePaymentsLogPDF(recent, settings);
    toast({ title: "Payments log downloaded", variant: "success" });
  };

  const reminder = (c: ReturnType<typeof buildRows>[number]) => {
    if (!settings) return;
    const msg = buildUdhaarReminder(settings, c, c.balance);
    const ok = openWhatsApp(c.phone, msg);
    if (!ok) toast({ title: "No phone number", description: `${c.name} has no phone number.`, variant: "destructive" });
  };

  return (
    <Shell>
      <PageHeader
        title="Udhaar Management"
        subtitle="Track outstanding customer balances and recent payments."
        actions={
          <>
            <Button variant="outline" onClick={handlePdf}><FileDown /> Report PDF</Button>
            <Button variant="outline" onClick={handleCsv}><FileText /> CSV</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Outstanding" value={`Rs. ${formatNumber(totalOutstanding)}`} icon={<HandCoins />} accent="red" />
        <StatCard label="Customers with Udhaar" value={String(rows.filter((r) => r.balance > 0).length)} icon={<Users />} accent="amber" />
        <StatCard label="Today's Payments" value={`Rs. ${formatNumber(todayPayments.reduce((s, p) => s + p.amount, 0))}`} icon={<Wallet />} accent="green" />
      </div>

      <div className="mt-5">
        <Tabs defaultValue="balances">
          <TabsList>
            <TabsTrigger value="balances">Customer Balances</TabsTrigger>
            <TabsTrigger value="payments">Recent Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <Card>
              <CardContent className="p-3 sm:p-4">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <EmptyState title="No customers yet" description="Add customers to start tracking udhaar balances." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead className="text-right">Purchases</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Link href={`/customers/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                              {r.openingBalance > 0 && <span className="ml-2 text-xs text-muted-foreground">+ opening {formatNumber(r.openingBalance)}</span>}
                            </TableCell>
                            <TableCell>{r.phone || "—"}</TableCell>
                            <TableCell className="text-right">{formatNumber(r.totalPurchases)}</TableCell>
                            <TableCell className="text-right">{formatNumber(r.totalPaid)}</TableCell>
                            <TableCell className="text-right">
                              {r.balance > 0 ? (
                                <Badge variant="warning">{formatNumber(r.balance)}</Badge>
                              ) : (
                                <Badge variant="success">Clear</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="iconSm" asChild title="Add payment">
                                  <Link href={`/customers/${r.id}`}><ArrowUpLeft /></Link>
                                </Button>
                                <Button variant="ghost" size="iconSm" onClick={() => reminder(r)} className="text-green-600 dark:text-green-500" title="WhatsApp reminder">
                                  <MessageCircle />
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
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="mb-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={handlePaymentsPdf}><FileDown /> Payments PDF</Button>
                </div>
                {recent.length === 0 ? (
                  <EmptyState title="No payments yet" description="Payments from bills and udhaar will appear here." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recent.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{formatDateTime(p.date)}</TableCell>
                            <TableCell>{p.customerName}</TableCell>
                            <TableCell>{p.type === "bill" ? "Bill payment" : "Udhaar payment"}</TableCell>
                            <TableCell>{p.invoiceNo || "—"}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell className="text-right font-medium text-green-600 dark:text-green-400">+ {formatNumber(p.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

function buildRows(rows: (Customer & { currentBalance: number; totalPurchases: number; totalPaid: number })[]) {
  return rows.map((c) => ({ ...c, balance: c.currentBalance }));
}