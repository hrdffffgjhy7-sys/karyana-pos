"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { addCustomer } from "@/db/customers";
import { validateCustomer } from "@/lib/validation";
import type { Customer } from "@/types";

export function AddCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (customer: Customer) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [openingBalance, setOpeningBalance] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setAddress("");
    setOpeningBalance("0");
    setNotes("");
    setError(null);
  };

  const handleSave = async () => {
    const err = validateCustomer({
      name,
      phone,
      openingBalance: parseFloat(openingBalance) || 0,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setSaving(true);
    try {
      const id = await addCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
        notes: notes.trim(),
      });
      const customer: Customer = {
        id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
        notes: notes.trim(),
        createdAt: Date.now(),
      };
      toast({ title: "Customer added", description: `${customer.name} saved.`, variant: "success" });
      onCreated?.(customer);
      reset();
      onOpenChange(false);
    } catch {
      setError("Could not save the customer. Please try again.");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> New Customer
          </DialogTitle>
          <DialogDescription>Add a customer to the store directory.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Khan" className="mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX XXXXXXX" className="mt-1" inputMode="tel" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop / street address" className="mt-1" />
          </div>
          <div>
            <Label>Opening Balance (Rs.)</Label>
            <Input type="number" min={0} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Customer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}