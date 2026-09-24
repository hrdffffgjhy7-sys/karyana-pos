"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowUpLeft,
  ReceiptText,
  MessageCircle,
  FileDown,
  FileText,
  Phone,
  MapPin,
} from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { getCustomer, getCustomerTransactions, calculateCustomerBalance } from "@/db/customers";
import { addPaymentAndBalance } from "@/db/payments";
import { paymentMethods } from "@/db/database";
import type { Customer, PaymentMethod } from "@/types";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { generateStatementPDF } from "@/lib/pdf";
import { downloadCsv } from "@/lib/csv";
import { buildUdhaarReminder, openWhatsApp } from "@/lib/whatsapp";

interface Txn {
  type: "bill" | "payment";
  date: number;
  invoiceNo: string;
  amount: number;
  paid: number;
  balanceAfter: number;
  method: string;
  note?: string;
  items: { name: string; quantity: number; unitPrice: number }[];
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { settings } = useSettings();
  const { toast } = useToast();

  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [balance, setBalance] = React.useState({ totalPurchases: 0, totalPaid: 0, currentBalance: 0 });
  const [txns, setTxns] = React.useState<Txn[]>([]);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>("Cash");
  const [payNote, setPayNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [c, b, t] = await Promise.all([
      getCustomer(id),
      calculateCustomerBalance(id),
      getCustomerTransactions(id),
    ]);
    setCustomer(c ?? null);
    setBalance(b);
    setTxns(t.transactions as Txn[]);
    setLoading(false);
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  useEffectOnceRedirect(id);

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive payment amount.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { newBalance } = await addPaymentAndBalance(id, {
        amount,
        method: payMethod,
        note: payNote || "Udhaar payment",
      });
      toast({
        title: "Payment recorded",
        description: `New balance: Rs. ${formatNumber(newBalance)}`,
        variant: "success",
      });
      setPaymentOpen(false);
      setPayAmount("");
      setPayNote("");
      load();
    } catch (e) {
      toast({ title: "Payment failed", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleWhatsAppReminder = () => {
    if (!customer || !settings) return;
    const msg = buildUdhaarReminder(settings, customer, balance.currentBalance);
    const ok = openWhatsApp(customer.phone, msg);
    if (!ok) toast({ title: "No phone number", description: "Add the customer's phone number first.", variant: "destructive" });
  };

  const handleStatementPdf = async () => {
    if (!customer || !settings) return;
    await generateStatementPDF(customer, txns, balance.currentBalance, settings);
    toast({ title: "Statement downloaded", description: `${customer.name} PDF statement saved.`, variant: "success" });
  };

  const handleStatementCsv = () => {
    if (!customer) return;
    const rows = txns.map((t) => [
      formatDateTime(t.date),
      t.type === "bill" ? "Bill" : "Payment",
      t.invoiceNo || "-",
      t.type === "bill" ? formatNumber(t.amount) : "",
      t.type === "payment" ? formatNumber(t.amount) : "",
      t.method,
    ]);
    rows.push(["", "", "Current Balance", "", formatNumber(balance.currentBalance), ""]);
    downloadCsv(
      ["Date", "Type", "Invoice #", "Bill Amount", "Payment", "Method"],
      rows,
      `IMRAN-ARAIN-STATEMENT-${customer.name.replace(/[^a-zA-Z0-9]+/g, "-").toUpperCase()}.csv`
    );
    toast({ title: "CSV downloaded", description: `${customer.name} statement saved as CSV.`, variant: "success" });
  };

  if (loading) {
    return (
      <Shell>
        <PageHeader title="Customer Profile" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </Shell>
    );
  }

  if (!customer) {
    return (
      <Shell>
        <EmptyState title="Customer not found" description="This customer may have been deleted." />
      </Shell>
    );
  }

  const lastBill = txns.find((t) => t.type === "bill");

  return (
    <Shell>
      <PageHeader
        title={customer.name}
        subtitle="Customer profile, udhaar and transaction history."
        actions={
          <>
            <Button asChild><Link href={`/bill/new?customerId=${customer.id}`}><ReceiptText /> Create Bill</Link></Button>
            <Button variant="outline" onClick={() => setPaymentOpen(true)}><ArrowUpLeft /> Add Payment</Button>
            <Button variant="outline" className="text-green-600 dark:text-green-500" onClick={handleWhatsAppReminder}>
              <MessageCircle /> WhatsApp
            </Button>
          </>
        }
      />

      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {customer.phone && (
            <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>
          )}
          {customer.address && (
            <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {customer.address}</span>
          )}
          {customer.notes && <span className="italic text-muted-foreground">Notes: {customer.notes}</span>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Purchases" value={`Rs. ${formatNumber(balance.totalPurchases)}`} icon={<ReceiptText />} />
        <StatCard label="Total Paid" value={`Rs. ${formatNumber(balance.totalPaid)}`} icon={<ArrowUpLeft />} accent="blue" />
        <StatCard label="Current Udhaar" value={`Rs. ${formatNumber(balance.currentBalance)}`} icon={<ReceiptText />} accent={balance.currentBalance > 0 ? "red" : "default"} />
        <StatCard
          label="Last Bill"
          value={lastBill ? lastBill.invoiceNo : "—"}
          icon={<ReceiptText />}
          accent="amber"
          sub={lastBill ? formatDate(lastBill.date) : undefined}
        />
        <StatCard label="Opening Balance" value={`Rs. ${formatNumber(customer.openingBalance)}`} icon={<ReceiptText />} />
      </div>

      <Card className="mt-5">
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">Transaction History</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleStatementPdf}><FileDown /> PDF</Button>
              <Button variant="outline" size="sm" onClick={handleStatementCsv}><FileText /> CSV</Button>
            </div>
          </div>

          {txns.length === 0 ? (
            <EmptyState title="No transactions yet" description="Create a bill or record a payment for this customer." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.slice(0, 100).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateTime(t.date)}</TableCell>
                      <TableCell>
                        {t.type === "bill" ? <Badge variant="secondary">Bill</Badge> : <Badge variant="success">Payment</Badge>}
                      </TableCell>
                      <TableCell>{t.invoiceNo || "—"}</TableCell>
                      <TableCell className="text-right">
                        {t.type === "bill" ? formatNumber(t.amount) : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.type === "payment" ? formatNumber(t.amount) : t.type === "bill" ? formatNumber(t.paid) : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.type === "bill" ? formatNumber(t.paid > 0 || t.balanceAfter ? t.balanceAfter : 0) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Current balance: Rs. {formatNumber(balance.currentBalance)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Amount (Rs.) *</Label>
              <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="mt-1">
                {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Optional note" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function useEffectOnceRedirect(id: number) {
  React.useEffect(() => {
    if (!id || isNaN(id)) {
      window.location.href = "/customers";
    }
  }, [id]);
}