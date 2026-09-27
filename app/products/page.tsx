"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Pencil, Trash2, PackagePlus, ArrowDownUp, FileDown, FileText, Package, ListPlus } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce";
import {
  listProducts,
  getProductCategories,
  addProduct,
  addProductsBulk,
  updateProduct,
  deleteProduct,
  adjustStock,
  perKgPrice,
  isWeightUnit,
  unitLabel,
  unitPriceLabel,
  UNIT_GROUPS,
} from "@/db/products";
import { generateProductsPDF } from "@/lib/pdf";
import { downloadCsv } from "@/lib/csv";
import { validateProduct } from "@/lib/validation";
import { formatNumber } from "@/lib/format";
import { getKaryanaList, KARYANA_LIST_SIZE } from "@/lib/seedData";
import type { Product, Unit } from "@/types";

// Weight products (Gram/Kg) store price per gram and stock in grams.
// Every other unit (Bottle, Packet, ML, ...) stores price per unit and a plain count.
const KG = 1000;

type EmptyProductForm = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: Unit;
  purchasePrice: string;
  sellingPrice: string;
  stock: string;
  minStock: string;
};

const EMPTY: EmptyProductForm = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  unit: "Gram",
  purchasePrice: "",
  sellingPrice: "",
  stock: "0",
  minStock: "0",
};

export default function ProductsPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const [lowOnly, setLowOnly] = React.useState(false);
  const debouncedSearch = useDebounce(search, 250);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Product | null>(null);
  const [form, setForm] = React.useState<EmptyProductForm>(EMPTY);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [stockOpen, setStockOpen] = React.useState(false);
  const [stockTarget, setStockTarget] = React.useState<Product | null>(null);
  const [delta, setDelta] = React.useState("");
  const [stockNote, setStockNote] = React.useState("");

  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null);
  const [seedOpen, setSeedOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [rows, cats] = await Promise.all([listProducts({ search: debouncedSearch, category, lowStockOnly: lowOnly }), getProductCategories()]);
    setProducts(rows);
    setCategories(cats);
    setLoading(false);
  }, [debouncedSearch, category, lowOnly]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY);
    setFormError(null);
    setFormOpen(true);
  };

  const formIsWeight = isWeightUnit(form.unit);

  const openEdit = (p: Product) => {
    setEditTarget(p);
    const weight = isWeightUnit(p.unit);
    setForm({
      name: p.name,
      sku: p.sku || "",
      barcode: p.barcode || "",
      category: p.category || "",
      unit: p.unit,
      purchasePrice: String(weight ? perKgPrice(p.purchasePrice ?? 0) : p.purchasePrice ?? 0),
      sellingPrice: String(weight ? perKgPrice(p.sellingPrice ?? 0) : p.sellingPrice ?? 0),
      stock: String(weight ? (p.stock ?? 0) / KG : p.stock ?? 0),
      minStock: String(weight ? (p.minStock ?? 0) / KG : p.minStock ?? 0),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const saveProduct = async () => {
    const sellInput = parseFloat(form.sellingPrice) || 0;
    const buyInput = parseFloat(form.purchasePrice) || 0;
    const stockInput = parseFloat(form.stock) || 0;
    const minInput = parseFloat(form.minStock) || 0;
    const weight = isWeightUnit(form.unit);
    // Weight: entered in KG, stored per gram / in grams. Others: stored as entered.
    const purchasePrice = weight ? buyInput / KG : buyInput;
    const sellingPrice = weight ? sellInput / KG : sellInput;
    const stock = weight ? Math.round(stockInput * KG) : stockInput;
    const minStock = weight ? Math.round(minInput * KG) : minInput;
    const err = validateProduct({ name: form.name.trim(), sellingPrice, purchasePrice, stock });
    if (err) {
      setFormError(err.message);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        category: form.category.trim() || "General",
        purchasePrice,
        sellingPrice,
        stock,
        minStock,
        unit: form.unit,
      };
      if (editTarget) {
        await updateProduct(editTarget.id!, payload);
        toast({ title: "Product updated", description: `${form.name} saved.`, variant: "success" });
      } else {
        await addProduct(payload);
        toast({ title: "Product added", description: `${form.name} added to inventory.`, variant: "success" });
      }
      setFormOpen(false);
      load();
    } catch (e) {
      setFormError((e as Error).message);
    }
    setSaving(false);
  };

  const saveStock = async () => {
    if (!stockTarget) return;
    const d = parseFloat(delta);
    if (isNaN(d) || d === 0) {
      toast({ title: "Invalid adjustment", description: "Enter a non-zero quantity.", variant: "destructive" });
      return;
    }
    try {
      await adjustStock(stockTarget.id!, d, stockNote.trim());
      toast({ title: "Stock updated", description: `${stockTarget.name} stock changed by ${formatNumber(d)} ${unitLabel(stockTarget.unit)}.`, variant: "success" });
      setStockOpen(false);
      setDelta("");
      setStockNote("");
      load();
    } catch (e) {
      toast({ title: "Stock update failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id!);
      toast({ title: "Product deleted", description: `${deleteTarget.name} removed.` });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ title: "Delete failed", description: "Could not delete the product.", variant: "destructive" });
    }
  };

  const handleSeedKaryana = async () => {
    setSeeding(true);
    try {
      const existing = new Set((await listProducts()).map((p) => p.name.toLowerCase()));
      const fresh = getKaryanaList().filter((p) => !existing.has(p.name.toLowerCase()));
      const added = await addProductsBulk(fresh);
      setSeedOpen(false);
      toast({
        title: `${added} karyana products added`,
        description:
          added === 0
            ? "Every karyana product is already in the inventory."
            : `${added} of ${KARYANA_LIST_SIZE} items added — prices per KG, stock in grams.`,
        variant: "success",
      });
      load();
    } catch (e) {
      toast({ title: "Seed failed", description: (e as Error).message, variant: "destructive" });
    }
    setSeeding(false);
  };

  const displayPrice = (perGramOrUnit: number, unit: Unit) =>
    isWeightUnit(unit) ? perKgPrice(perGramOrUnit) : perGramOrUnit;

  const exportCsv = () => {
    downloadCsv(
      ["Product", "SKU", "Barcode", "Category", "Purchase Price", "Selling Price", "Stock", "Min Stock", "Unit"],
      products.map((p) => [
        p.name,
        p.sku,
        p.barcode,
        p.category,
        displayPrice(p.purchasePrice, p.unit),
        displayPrice(p.sellingPrice, p.unit),
        formatNumber(p.stock),
        formatNumber(p.minStock),
        p.unit,
      ]),
      "IMRAN-ARAIN-PRODUCTS.csv"
    );
    toast({ title: "Products CSV downloaded", variant: "success" });
  };

  const exportPdf = () => {
    if (!settings) return;
    generateProductsPDF(
      products.map((p) => ({
        ...p,
        purchasePrice: displayPrice(p.purchasePrice, p.unit),
        sellingPrice: displayPrice(p.sellingPrice, p.unit),
      })),
      settings,
      category
    );
    toast({ title: "Products PDF downloaded", variant: "success" });
  };

  return (
    <Shell>
      <PageHeader
        title="Products"
        subtitle={`${products.length} products • ${products.filter((p) => p.stock <= p.minStock).length} low stock`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><FileText /> CSV</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown /> PDF</Button>
            <Button variant="outline" onClick={() => setSeedOpen(true)} disabled={seeding}><ListPlus /> {KARYANA_LIST_SIZE} Karyana</Button>
            <Button onClick={openAdd}><PackagePlus /> Add Product</Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, barcode…" className="h-10 pl-9" />
            </div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-44">
              <option value="All">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium">
              <Checkbox checked={lowOnly} onCheckedChange={(v) => setLowOnly(!!v)} />
              Low stock only
            </label>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState icon={<Package />} title="No products found" description="Add products to start billing." action={<Button onClick={openAdd}><PackagePlus /> Add Product</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU / Barcode</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Purchase</TableHead>
                    <TableHead className="text-right">Selling</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku || "—"}{p.barcode ? ` / ${p.barcode}` : ""}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatNumber(displayPrice(p.purchasePrice, p.unit))}/{unitLabel(p.unit)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(displayPrice(p.sellingPrice, p.unit))}/{unitLabel(p.unit)}</TableCell>
                      <TableCell className="text-right">{formatNumber(p.stock)} {unitLabel(p.unit)}</TableCell>
                      <TableCell>
                        {p.stock <= 0 ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : p.stock <= p.minStock ? (
                          <Badge variant="warning">Low Stock</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="iconSm" onClick={() => { setStockTarget(p); setStockOpen(true); }} title="Adjust stock">
                            <ArrowDownUp />
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => openEdit(p)} title="Edit">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="iconSm" onClick={() => setDeleteTarget(p)} className="text-muted-foreground hover:text-destructive" title="Delete">
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

      {/* Add/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>Fill in the product details. Prices are in Rs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {formError && <p className="sm:col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
            <div className="sm:col-span-2">
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Barcode</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="product-categories" className="mt-1" />
              <datalist id="product-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label>Unit</Label>
              <Select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}
                className="mt-1"
              >
                {UNIT_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div>
              <Label>Purchase Price ({unitPriceLabel(form.unit)})</Label>
              <Input type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Selling Price ({unitPriceLabel(form.unit)}) *</Label>
              <Input type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} className="mt-1" />
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              {formIsWeight
                ? "Weight items: price is stored per gram (1 KG price ÷ 1000) and stock in grams (1 KG = 1000 g). Billing uses grams — Aadha Pao 125 g, 1 Pao 250 g, Aadha Kilo 500 g, 1 Kilo 1000 g."
                : `Counted items: price and stock are stored per ${unitLabel(form.unit)} and billed one ${unitLabel(form.unit)} at a time.`}
            </p>
            <div>
              <Label>Stock ({formIsWeight ? "KG" : unitLabel(form.unit)})</Label>
              <Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1" placeholder={formIsWeight ? "e.g. 40" : "e.g. 24"} />
            </div>
            <div>
              <Label>Minimum Stock ({formIsWeight ? "KG" : unitLabel(form.unit)})</Label>
              <Input type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveProduct} disabled={saving}>{saving ? "Saving…" : "Save Product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock adjustment */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Stock Adjustment</DialogTitle>
            <DialogDescription>
              {stockTarget?.name} — current stock {stockTarget ? `${formatNumber(stockTarget.stock)} ${unitLabel(stockTarget.unit)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Adjust By ({stockTarget && isWeightUnit(stockTarget.unit) ? "grams" : unitLabel(stockTarget?.unit ?? "Piece")})</Label>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. +1000 or -250" className="mt-1" autoFocus />
              <p className="mt-1 text-xs text-muted-foreground">
                {stockTarget && isWeightUnit(stockTarget.unit)
                  ? "1 KG = 1000 g. Positive adds stock, negative removes stock."
                  : "Positive adds stock, negative removes stock."}
              </p>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="e.g. New shipment received" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
            <Button onClick={saveStock}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={seedOpen} onOpenChange={(o) => !o && !seeding && setSeedOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add {KARYANA_LIST_SIZE} karyana products?</AlertDialogTitle>
            <AlertDialogDescription>
              Common grocery items (atta, rice, dal, spices, oil, drinks, household, personal care) are added with
              default Rs/KG prices and gram stock. Products already in your inventory are skipped, and nothing is
              overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={seeding}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={seeding} onClick={handleSeedKaryana}>
              {seeding ? "Adding…" : "Add products"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently removed from inventory. Past bills keep their records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}