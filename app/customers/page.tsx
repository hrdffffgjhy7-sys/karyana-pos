"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Eye, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
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
import { updateCustomer, deleteCustomer, getAllCustomerBalances } from "@/db/customers";
import type { Customer } from "@/types";
import { formatNumber } from "@/lib/format";
import { validateCustomer } from "@/lib/validation";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";

type Row = Customer & { currentBalance: number; totalPurchases: number };

export default function CustomersPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Row | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const all = await getAllCustomerBalances();
    const q = debouncedSearch.toLowerCase();
    const filtered = q
      ? all.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        )
      : all;
    setRows(filtered);
    setLoading(false);
  }, [debouncedSearch]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id!);
      toast({ title: "Customer deleted", description: `${deleteTarget.name} and their bills were removed.` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message || "Could not delete the customer.", variant: "destructive" });
    }
  };

  const totalUdhaar = rows.reduce((s, r) => s + Math.max(r.currentBalance, 0), 0);

  return (
    <Shell>
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} customers • Total Udhaar ${settings?.currencySymbol ?? "Rs."} ${formatNumber(totalUdhaar)}`}
        actions={<Button onClick={() => setAddOpen(true)}><UserPlus /> Add Customer</Button>}
      />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="h-10 pl-9"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No customers yet"
              description="Add your first customer to track their bills and udhaar."
              action={<Button onClick={() => setAddOpen(true)}><UserPlus /> Add Customer</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        {c.openingBalance > 0 && <span className="ml-2 text-xs text-muted-foreground">(opening {formatNumber(c.openingBalance)})</span>}
                      </TableCell>
                      <TableCell>{c.phone || "-"}</TableCell>
                      <TableCell className="text-right">{formatNumber(c.totalPurchases)}</TableCell>
                      <TableCell>
                        {c.currentBalance > 0 ? (
                          <Badge variant="warning">{formatNumber(c.currentBalance)} udhaar</Badge>
                        ) : (
                          <Badge variant="success">Clear</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="iconSm" asChild title="Profile">
                            <Link href={`/customers/${c.id}`}><Eye /></Link>
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => setEditTarget(c)} title="Edit">
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => setDeleteTarget(c)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
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

      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => load()} />

      <EditCustomerDialog
        customer={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          load();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>, all their bills, items and payment
              records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

function EditCustomerDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [openingBalance, setOpeningBalance] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || "");
      setAddress(customer.address || "");
      setOpeningBalance(String(customer.openingBalance ?? 0));
      setNotes(customer.notes || "");
      setError(null);
    }
  }, [customer]);

  const save = async () => {
    if (!customer) return;
    const err = validateCustomer({ name, phone, openingBalance: parseFloat(openingBalance) || 0 });
    if (err) {
      setError(err.message);
      return;
    }
    setSaving(true);
    try {
      await updateCustomer(customer.id!, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
        notes: notes.trim(),
      });
      toast({ title: "Customer updated", description: `${name.trim()} saved.`, variant: "success" });
      onSaved();
    } catch {
      setError("Could not update the customer.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>Update {customer?.name} details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" inputMode="tel" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Opening Balance (Rs.)</Label>
            <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}