"use client";

import * as React from "react";
import { Save, Upload, DatabaseBackup, DatabaseZap, Sparkles, Trash2, Store, MessageSquareText, ImageUp, RefreshCw } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { saveSettings } from "@/db/settings";
import type { ReceiptSize } from "@/types";
import { fileToDataUrl } from "@/lib/logo";
import { generateDefaultLogo } from "@/lib/logo";
import { exportBackup, importBackup, clearAllData } from "@/lib/backup";
import { loadDemoData } from "@/db/seed";

export default function SettingsPage() {
  const { settings, ready, refresh } = useSettings();
  const { toast } = useToast();

  const [form, setForm] = React.useState<Record<string, string | boolean | null>>({});
  const [saving, setSaving] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [demoOpen, setDemoOpen] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  React.useEffect(() => {
    if (ready && settings) {
      setForm({
        storeName: settings.storeName,
        ownerName: settings.ownerName,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
        invoicePrefix: settings.invoicePrefix,
        startingInvoiceNumber: settings.startingInvoiceNumber,
        receiptSize: settings.receiptSize,
        allowNegativeStock: settings.allowNegativeStock,
        billWhatsappTemplate: settings.billWhatsappTemplate,
        udhaarWhatsappTemplate: settings.udhaarWhatsappTemplate,
      });
      setLogoPreview(settings.logo || generateDefaultLogo());
    }
  }, [ready, settings]);

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!settings) return;
    if (!String(form.storeName).trim()) {
      toast({ title: "Store name required", description: "Store name cannot be empty.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        storeName: String(form.storeName).trim(),
        ownerName: String(form.ownerName).trim(),
        phone: String(form.phone).trim(),
        whatsapp: String(form.whatsapp).trim(),
        address: String(form.address).trim(),
        currency: String(form.currency).trim() || "PKR",
        currencySymbol: String(form.currencySymbol).trim() || "Rs.",
        invoicePrefix: String(form.invoicePrefix).trim() || "IAK",
        startingInvoiceNumber: String(form.startingInvoiceNumber).trim(),
        receiptSize: form.receiptSize as ReceiptSize,
        allowNegativeStock: !!form.allowNegativeStock,
        billWhatsappTemplate: String(form.billWhatsappTemplate),
        udhaarWhatsappTemplate: String(form.udhaarWhatsappTemplate),
        logo: logoPreview && logoPreview !== settings.logo ? logoPreview : settings.logo,
      });
      refresh();
      toast({ title: "Settings saved", description: "Your store information was updated.", variant: "success" });
    } catch {
      toast({ title: "Could not save settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleLogo = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Logo must be under 2 MB.", variant: "destructive" });
      return;
    }
    const data = await fileToDataUrl(file);
    setLogoPreview(data);
    toast({ title: "Logo selected", description: "Save settings to apply the new logo." });
  };

  const resetLogo = () => {
    setLogoPreview(generateDefaultLogo());
  };

  const handleBackup = async () => {
    try {
      await exportBackup();
      toast({ title: "Backup downloaded", description: "Full JSON backup saved.", variant: "success" });
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    }
  };

  const handleRestore = async (file?: File) => {
    if (!file) return;
    setRestoring(true);
    try {
      const res = await importBackup(file);
      await refresh();
      toast({
        title: "Backup restored",
        description: `Imported ${res.products} products, ${res.customers} customers, ${res.bills} bills, ${res.payments} payments.`,
        variant: "success",
      });
    } catch (e) {
      toast({ title: "Restore failed", description: (e as Error).message, variant: "destructive" });
    }
    setRestoring(false);
  };

  const handleDemo = async () => {
    try {
      const res = await loadDemoData();
      toast({ title: "Demo data loaded", description: `${res.products} products and ${res.customers} customers added.`, variant: "success" });
      setDemoOpen(false);
      refresh();
    } catch (e) {
      toast({ title: "Demo data not loaded", description: (e as Error).message, variant: "destructive" });
      setDemoOpen(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearAllData();
      await refresh();
      setConfirmText("");
      toast({ title: "All data cleared", description: "The database has been reset." });
      setClearConfirmOpen(false);
      setClearOpen(false);
    } catch {
      toast({ title: "Clear failed", variant: "destructive" });
    }
  };

  return (
    <Shell>
      <PageHeader
        title="Settings"
        subtitle="Store information, invoice and receipt preferences, WhatsApp templates and data safety."
        actions={<Button onClick={save} disabled={saving}><Save /> {saving ? "Saving…" : "Save Settings"}</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="text-primary" /> Store Information</CardTitle>
            <CardDescription>Editable store details used on bills, invoices and WhatsApp messages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>Store Name</Label>
              <Input value={String(form.storeName ?? "")} onChange={(e) => set("storeName", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Owner Name</Label>
              <Input value={String(form.ownerName ?? "")} onChange={(e) => set("ownerName", e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={String(form.phone ?? "")} onChange={(e) => set("phone", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>WhatsApp Number</Label>
                <Input value={String(form.whatsapp ?? "")} onChange={(e) => set("whatsapp", e.target.value)} placeholder="923XXXXXXXXX" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={String(form.address ?? "")} onChange={(e) => set("address", e.target.value)} className="mt-1" />
            </div>

            <Separator />
            <div>
              <Label>Store Logo</Label>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Store logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-bold text-primary">IAK</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} />
                    <Button asChild variant="outline" size="sm" onClick={() => {}}><span><ImageUp /> Upload Logo</span></Button>
                  </label>
                  <Button variant="ghost" size="sm" onClick={resetLogo}><RefreshCw /> Reset Logo</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice & Receipt Preferences</CardTitle>
            <CardDescription>How invoices are numbered and printed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Currency</Label>
                <Input value={String(form.currency ?? "")} onChange={(e) => set("currency", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Currency Symbol</Label>
                <Input value={String(form.currencySymbol ?? "")} onChange={(e) => set("currencySymbol", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Invoice Prefix</Label>
                <Input value={String(form.invoicePrefix ?? "")} onChange={(e) => set("invoicePrefix", e.target.value)} className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">e.g. IAK → IAK-0001</p>
              </div>
              <div>
                <Label>Starting Invoice Number</Label>
                <Input value={String(form.startingInvoiceNumber ?? "")} onChange={(e) => set("startingInvoiceNumber", e.target.value)} className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">e.g. 0001</p>
              </div>
            </div>
            <div>
              <Label>Default Receipt Size</Label>
              <Select value={String(form.receiptSize ?? "80mm")} onChange={(e) => set("receiptSize", e.target.value)} className="mt-1">
                <option value="58mm">58mm Thermal</option>
                <option value="80mm">80mm Thermal</option>
                <option value="A4">A4 Full Page</option>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Allow Negative Stock</p>
                <p className="text-xs text-muted-foreground">When ON, bills can be saved even if stock goes below zero.</p>
              </div>
              <Switch checked={!!form.allowNegativeStock} onCheckedChange={(v) => set("allowNegativeStock", v)} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquareText className="text-primary" /> WhatsApp Message Templates</CardTitle>
            <CardDescription>
              Available placeholders: {"{STORE_NAME} {INVOICE_NO} {ITEMS} {SUBTOTAL} {DISCOUNT} {TOTAL} {PAID} {REMAINING} {BALANCE} {CUSTOMER_NAME}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label>Bill Message Template</Label>
              <Textarea
                rows={12}
                value={String(form.billWhatsappTemplate ?? "")}
                onChange={(e) => set("billWhatsappTemplate", e.target.value)}
                className="mt-1 font-mono text-xs"
                placeholder="Assalam-o-Alaikum, ..."
              />
            </div>
            <div>
              <Label>Udhaar Reminder Template</Label>
              <Textarea
                rows={12}
                value={String(form.udhaarWhatsappTemplate ?? "")}
                onChange={(e) => set("udhaarWhatsappTemplate", e.target.value)}
                className="mt-1 font-mono text-xs"
                placeholder="Assalam-o-Alaikum, ..."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseBackup className="text-primary" /> Data Safety</CardTitle>
            <CardDescription>Backup, restore, demo data and danger zone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" onClick={handleBackup}><DatabaseBackup /> Download Full Backup</Button>
              <label className="cursor-pointer">
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => handleRestore(e.target.files?.[0])} />
                <Button asChild variant="outline" disabled={restoring}>
                  <span><Upload /> {restoring ? "Restoring…" : "Restore Backup (JSON)"}</span>
                </Button>
              </label>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setDemoOpen(true)}><Sparkles /> Load Demo Data</Button>
              <Button variant="destructive" onClick={() => setClearOpen(true)}><Trash2 /> Clear All Data</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clear data first step */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all products, customers, bills and payments. We recommend
              downloading a backup first. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setClearOpen(false); setClearConfirmOpen(true); }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear data confirm */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={(o) => { setClearConfirmOpen(o); if (!o) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Type <strong>DELETE</strong> to permanently erase all data. This will reset the database and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Confirmation</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" className="mt-1" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" disabled={confirmText !== "DELETE"} onClick={handleClear}>
              <Trash2 /> Permanently Delete All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demo data confirm */}
      <AlertDialog open={demoOpen} onOpenChange={setDemoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              Adds 20 sample products and 4 customers with realistic PKR prices. Demo data will never
              overwrite existing data — it only loads if your database is empty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDemo()}>Load Demo Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}