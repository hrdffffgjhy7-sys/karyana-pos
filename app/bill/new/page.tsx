"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Minus,
  Plus,
  Trash2,
  UserRound,
  ShoppingCart,
  Save,
  Printer,
  FileDown,
  MessageCircle,
  PackagePlus,
  ReceiptText,
} from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce";
import { listProducts, getProductCategories, isWeightUnit, perKgPrice, GRAM_PRESETS } from "@/db/products";
import { listCustomers } from "@/db/customers";
import { createBill, getCustomerRunningBalanceById } from "@/db/bills";
import { paymentMethods } from "@/db/database";
import type { Product, Customer, CartItemInput, Bill, BillItem, PaymentMethod } from "@/types";
import { validateBillInput } from "@/lib/validation";
import { formatNumber } from "@/lib/format";
import { printInvoice } from "@/lib/print";
import { generateInvoicePDF } from "@/lib/pdf";
import { buildBillWhatsApp, openWhatsApp } from "@/lib/whatsapp";
import { Receipt as ReceiptIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";

interface CartItem extends CartItemInput {}

export default function NewBillPage() {
  const { settings } = useSettings();
  const { toast } = useToast();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const debouncedSearch = useDebounce(search, 200);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [customerId, setCustomerId] = React.useState<number | undefined>();
  const [previousBalance, setPreviousBalance] = React.useState(0);
  const [discount, setDiscount] = React.useState("");
  const [paid, setPaid] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("Cash");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ bill: Bill; items: BillItem[] } | null>(null);
  const [addCustomerOpen, setAddCustomerOpen] = React.useState(false);
  const cartRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    const [prods, custs, cats] = await Promise.all([
      listProducts(),
      listCustomers(),
      getProductCategories(),
    ]);
    setProducts(prods);
    setCustomers(custs);
    setCategories(cats);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("customerId");
    if (cid) setCustomerId(Number(cid));
  }, []);

  const filtered = React.useMemo(() => {
    return products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
      );
    });
  }, [products, category, debouncedSearch]);

  React.useEffect(() => {
    if (customerId) {
      getCustomerRunningBalanceById(customerId).then(setPreviousBalance);
    } else {
      setPreviousBalance(0);
    }
  }, [customerId]);

  const qtyOf = (productId: number) => cart.find((c) => c.productId === productId)?.quantity ?? 0;

  const addGramsToCart = (p: Product, grams: number) => {
    if (!grams || grams <= 0) return;
    const disableNeg = !settings?.allowNegativeStock;
    const nextQty = (qtyOf(p.id!) + grams);
    if (disableNeg && nextQty > p.stock) {
      toast({ title: "Not enough stock", description: `Only ${formatNumber(p.stock)} g available.`, variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id!);
      if (existing) {
        return prev.map((c) =>
          c.productId === p.id! ? { ...c, quantity: c.quantity + grams } : c
        );
      }
      if (p.stock <= 0 && disableNeg) {
        toast({ title: "Out of stock", description: `${p.name} is out of stock.`, variant: "destructive" });
        return prev;
      }
      return [
        ...prev,
        {
          productId: p.id!,
          name: p.name,
          quantity: grams,
          unitPrice: p.sellingPrice,
          unit: "g",
          stock: p.stock,
        },
      ];
    });
  };

  const addToCart = (p: Product) => {
    addGramsToCart(p, GRAM_PRESETS[1].grams);
  };

  const updateQty = (productId: number, productStock: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) {
      setCart((prev) => prev.filter((c) => c.productId !== productId));
      return;
    }
    const disableNeg = !settings?.allowNegativeStock;
    if (disableNeg && newQty > productStock) {
      toast({ title: "Not enough stock", description: `Only ${formatNumber(productStock)} g available.`, variant: "destructive" });
      return;
    }
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, quantity: newQty } : c)));
  };

  const updatePrice = (productId: number, price: number) => {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, unitPrice: price } : c)));
  };

  const removeItem = (productId: number) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const discountNum = parseFloat(discount) || 0;
  const safeDiscount = Math.min(discountNum, subtotal);
  const grandTotal = subtotal - safeDiscount;
  const paidNum = parseFloat(paid) || 0;
  const remaining = previousBalance + grandTotal - paidNum;

  const customer = customers.find((c) => c.id === customerId);

  const handleSave = async () => {
    const err = validateBillInput({
      itemsCount: cart.length,
      subtotal,
      discount: discountNum,
      paid: paidNum,
      previousBalance,
    });
    if (err) {
      toast({ title: "Invalid bill", description: err.message, variant: "destructive" });
      return;
    }
    if (!settings) return;
    setSaving(true);
    try {
      const savedItems: BillItem[] = cart.map((c) => ({
        productId: c.productId,
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        total: c.quantity * c.unitPrice,
        unit: c.unit,
        billId: 0,
      }));
      const { bill } = await createBill({
        customerId,
        customerName: customer?.name || "Walk-in Customer",
        customerPhone: customer?.phone || "",
        items: cart,
        discount: safeDiscount,
        paid: paidNum,
        paymentMethod: method,
      });
      setResult({ bill: bill!, items: savedItems });
      toast({ title: "Bill created successfully", description: `${bill!.invoiceNo} saved.`, variant: "success" });
      setCart([]);
      setDiscount("");
      setPaid("");
      setMethod("Cash");
      setCustomerId(undefined);
      await load();
    } catch (e) {
      toast({ title: "Could not save bill", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handlePrintResult = async () => {
    if (!result || !settings) return;
    try {
      await printInvoice(settings, result.bill, result.items);
    } catch (e) {
      toast({ title: "Could not print", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePdfResult = async () => {
    if (!result || !settings) return;
    await generateInvoicePDF(result.bill, result.items, settings);
    toast({ title: "PDF downloaded", description: `${result.bill.invoiceNo} saved as PDF.`, variant: "success" });
  };

  const handleWhatsAppResult = () => {
    if (!result || !settings) return;
    const msg = buildBillWhatsApp(settings, result.bill, result.items);
    const ok = openWhatsApp(result.bill.customerPhone, msg);
    if (!ok) toast({ title: "No phone number", description: "Add a phone number to send on WhatsApp.", variant: "destructive" });
  };

  const scrollToCart = () => {
    cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Shell>
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Products */}
        <div className="lg:col-span-3">
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product… (name, SKU, barcode)"
              className="h-11 pl-9 text-base"
              autoFocus
            />
          </div>

          <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
            <Chip active={category === "All"} onClick={() => setCategory("All")}>All</Chip>
            {categories.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Try a different search or add the product from the Products page."
              action={<Button asChild><Link href="/products"><PackagePlus /> Manage Products</Link></Button>}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const inCart = qtyOf(p.id!) > 0;
                const low = p.stock <= p.minStock && p.stock > 0;
                if (isWeightUnit(p.unit)) {
                  return (
                    <WeightProductCard
                      key={p.id}
                      p={p}
                      inCartGrams={qtyOf(p.id!)}
                      addGrams={addGramsToCart}
                      allowNegative={!!settings?.allowNegativeStock}
                    />
                  );
                }
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={!settings?.allowNegativeStock && p.stock <= 0}
                    className={cn(
                      "group relative flex flex-col rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                      inCart && "ring-2 ring-primary",
                      !settings?.allowNegativeStock && p.stock <= 0 && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                      {inCart && (
                        <Badge variant="default" className="shrink-0">{qtyOf(p.id!)}</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="text-base font-bold text-primary">Rs. {formatNumber(perKgPrice(p.sellingPrice))}</p>
                      <p className="text-xs text-muted-foreground">/ KG</p>
                    </div>
                    <p className={cn("mt-1 text-xs", low ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                      {p.stock <= 0 ? "Out of Stock" : `Stock: ${formatNumber(p.stock)} g`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div ref={cartRef} className="lg:col-span-2">
          <Card className="lg:sticky lg:top-20">
            <CardContent className="p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <ShoppingCart className="h-4 w-4" /> Current Bill
                  {cart.length > 0 && <Badge variant="secondary">{cart.length}</Badge>}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setCart([])} disabled={!cart.length}>
                  Clear
                </Button>
              </div>

              {/* Customer */}
              <div className="mb-3 flex gap-2">
                <div className="flex-1">
                  <Label className="mb-1 flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> Customer</Label>
                  <Select
                    value={customerId ? String(customerId) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomerId(v ? Number(v) : undefined);
                    }}
                    className="h-11"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="mt-5 h-11 w-10"
                  onClick={() => setAddCustomerOpen(true)}
                  title="Add new customer"
                >
                  <Plus />
                </Button>
              </div>

              {previousBalance > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                  <span className="text-amber-800 dark:text-amber-300">Previous Balance</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300">Rs. {formatNumber(previousBalance)}</span>
                </div>
              )}

              {/* Items */}
              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Tap products to add to the bill.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1 sm:max-h-80">
                  {cart.map((c) => (
                    <div key={c.productId} className="rounded-lg border bg-background p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-medium">{c.name}</p>
                        <button onClick={() => removeItem(c.productId)} className="text-muted-foreground transition-colors hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-lg border">
                          <button onClick={() => updateQty(c.productId, c.stock, c.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-accent">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={c.quantity}
                            onChange={(e) => updateQty(c.productId, c.stock, parseFloat(e.target.value) || 0)}
                            className="h-8 w-16 border-0 bg-transparent text-center text-sm font-semibold focus:outline-none"
                            title="Custom grams (e.g. 100, 50)"
                          />
                          <button onClick={() => updateQty(c.productId, c.stock, c.quantity + 1)} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-accent">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={c.unitPrice}
                            onChange={(e) => updatePrice(c.productId, parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 rounded-lg border bg-background px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <span className="text-sm text-muted-foreground">/g</span>
                        </div>
                        <p className="w-16 text-right text-sm font-bold">{formatNumber(c.quantity * c.unitPrice)}</p>
                      </div>
                      {/* Fast-sale gram buttons */}
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {GRAM_PRESETS.map((q) => (
                          <button
                            key={q.grams}
                            onClick={() => updateQty(c.productId, c.stock, q.grams)}
                            disabled={c.quantity === q.grams}
                            className={cn(
                              "rounded-md border px-1 py-1 text-center text-xs font-semibold leading-tight transition-colors",
                              c.quantity === q.grams
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            {q.label}
                            <span className="block text-[10px] font-normal opacity-80">{q.grams}g</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Discount</Label>
                    <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label>Paid Amount</Label>
                    <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="mt-1">
                    {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>

                <SummaryRow label="Subtotal" value={`Rs. ${formatNumber(subtotal)}`} />
                <SummaryRow label="Discount" value={`- Rs. ${formatNumber(safeDiscount)}`} muted />
                {previousBalance > 0 && <SummaryRow label="Previous Balance" value={`Rs. ${formatNumber(previousBalance)}`} />}
                <div className="border-t pt-1">
                  <SummaryRow label="Grand Total" value={`Rs. ${formatNumber(grandTotal)}`} bold />
                </div>
                <SummaryRow label="Paid" value={`Rs. ${formatNumber(paidNum)}`} />
                <SummaryRow
                  label="Remaining"
                  value={`Rs. ${formatNumber(remaining)}`}
                  bold
                  className={remaining > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
                />
              </div>

              <Button className="mt-4 h-11 w-full text-base" onClick={handleSave} disabled={saving || !cart.length}>
                <Save /> {saving ? "Saving…" : "Save Bill"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Press also{" "}
                <button onClick={scrollToCart} className="text-primary underline-offset-2 hover:underline">
                  scroll to cart
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile bottom bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-2 lg:hidden">
          <Button className="w-full h-12" onClick={scrollToCart}>
            <ReceiptIcon /> View Bill — {cart.length} items • Rs. {formatNumber(subtotal)}
          </Button>
        </div>
      )}

      <AddCustomerDialog
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onCreated={(c) => {
          setCustomers((prev) => [...prev, c]);
          setCustomerId(c.id);
        }}
      />

      {/* Success dialog */}
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" /> Bill Saved
            </DialogTitle>
            <DialogDescription>
              {result?.bill.invoiceNo} • Total: Rs. {result ? formatNumber(result.bill.grandTotal) : 0}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handlePrintResult}><Printer /> Print</Button>
            <Button variant="outline" onClick={handlePdfResult}><FileDown /> PDF</Button>
            <Button variant="outline" onClick={handleWhatsAppResult} className="text-green-600 dark:text-green-500">
              <MessageCircle /> WhatsApp
            </Button>
            <Button variant="outline" onClick={() => setResult(null)}>New Bill</Button>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/bills">View all bills</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function WeightProductCard({ p, inCartGrams, addGrams, allowNegative }: { p: Product; inCartGrams: number; addGrams: (p: Product, grams: number) => void; allowNegative: boolean }) {
  const [custom, setCustom] = React.useState("");
  const out = p.stock <= 0;
  const low = p.stock <= p.minStock && p.stock > 0;
  const add = (grams: number) => addGrams(p, grams);
  const outCls = !allowNegative && out ? "opacity-40 pointer-events-none" : "";
  return (
    <div className="flex flex-col rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
        {inCartGrams > 0 && (
          <Badge variant="default" className="shrink-0">{formatNumber(inCartGrams)} g</Badge>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-base font-bold text-primary">
          Rs. {formatNumber(perKgPrice(p.sellingPrice))}
          <span className="text-xs font-normal text-muted-foreground"> / KG</span>
        </p>
        <p className="text-xs text-muted-foreground">g</p>
      </div>
      <p className={cn("mt-1 text-xs", low ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {out ? "Out of Stock" : `Stock: ${formatNumber(p.stock)} g`}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {GRAM_PRESETS.map((b) => (
          <button
            key={b.grams}
            type="button"
            onClick={() => add(b.grams)}
            disabled={!allowNegative && out}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed",
              outCls
            )}
          >
            {b.label}
            <span className="block text-[10px] font-normal text-muted-foreground">{formatNumber(b.grams)} g</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <div className="relative flex-1">
          <Input
            type="number"
            min={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Custom grams"
            className="h-9 pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0"
          onClick={() => {
            const g = parseFloat(custom);
            if (!g || g <= 0) return;
            add(g);
            setCustom("");
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold, muted, className }: { label: string; value: string; bold?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", bold ? "text-base font-bold" : "", muted && "text-muted-foreground", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}